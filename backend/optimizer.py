"""Weekly EV charging optimizer -- a small layered DP over the week.

Steps:
  1. size the battery (simple heuristic, then fixed)
  2. turn the backend data into a timeline of drive / park events
  3. DP chooses where & how much to charge, minimizing:
         detour_km  +  session_penalty(k)  +  care * money_eur

Because the battery starts AND ends the week at 100%, the total energy charged
is fixed (= the week's driving); so cost is about WHICH stations carry it.
"""

import math
import dataclasses

from .location import DayOfWeek
from .config import (CONSUMPTION_KWH_PER_KM, FLOOR_FRACTION, SIZING_MARGIN,
                     SOC_STEP_KWH, SESSION_PENALTY_KM_PER_CHARGE, DETOUR_GROWTH,
                     PRICE_BASE_EUR, PRICE_PER_KW_EUR, COST_CARE)


def session_penalty(k):
    """k charges cost KM_PER_CHARGE * (1+2+...+k) km."""
    return SESSION_PENALTY_KM_PER_CHARGE * k * (k + 1) / 2


def detour_cost(km):
    """Detour pain grows exponentially with distance."""
    return DETOUR_GROWTH ** km - 1.0


def price_per_kwh(speed_kw):
    """Price grows linearly with charging speed: faster => pricier."""
    return PRICE_BASE_EUR + PRICE_PER_KW_EUR * speed_kw


@dataclasses.dataclass
class Slot:
    """One way to charge at a parked point: a station with its limits."""
    point: str
    station: str
    speed_kw: float
    dwell_min: int
    detour_km: float
    price: float            # EUR/kWh, derived from charging speed (see config)
    source: object          # the original ChargingStation (for the API response)


def build_events(backend, home, locations, distances):
    """Chronological list of ('drive', day, kWh) and ('park', day, label, slots)."""
    # home is parked every day; the other points only on their visit days
    points = [("Home", home)] + [(f"Stop {i + 1}", loc)
                                 for i, loc in enumerate(locations)]
    events = []
    for d in DayOfWeek:
        events.append(("drive", d, distances[d] * CONSUMPTION_KWH_PER_KM))
        for label, p in points:
            if label != "Home" and d not in p.visits:
                continue
            slots = [
                Slot(label, f"{s.charger_type.name}{s.charger_kilowatts}kW",
                     s.charger_kilowatts, p.time_spent,
                     s.distance_to_location, price_per_kwh(s.charger_kilowatts), s)
                for s in backend.best_charging_stations(p)
            ]
            events.append(("park", d, label, slots))
    return events


# --- DP state = (event index, SoC bucket, #sessions); SoC discretized -----------
def _q(soc, cap):
    return min(int(round(soc / SOC_STEP_KWH)), int(round(cap / SOC_STEP_KWH)))


def _dq(b, cap):
    return min(b * SOC_STEP_KWH, cap)


def solve(events, capacity, floor_kwh, care):
    cap_b = _q(capacity, capacity)          # "full" = the top SoC bucket
    dp = {(cap_b, 0): 0.0}                   # state -> best cost so far
    back = {(0, cap_b, 0): None}            # for reconstructing the plan

    for i, ev in enumerate(events):
        ndp = {}

        def relax(state, cost, action):
            if cost < ndp.get(state, math.inf) - 1e-12:
                ndp[state] = cost
                back[(i + 1, *state)] = (i, src, action)

        for (soc_b, k), cost in dp.items():
            src = (soc_b, k)
            soc = _dq(soc_b, capacity)

            if ev[0] == "drive":
                nsoc = soc - ev[2]
                if nsoc < floor_kwh - 1e-9:          # would breach the floor
                    continue
                relax((_q(nsoc, capacity), k), cost, ("drive", ev[1], ev[2]))
                continue

            # park: either skip, or charge some amount at one station
            _, day, label, slots = ev
            relax((soc_b, k), cost, ("idle",))
            headroom = capacity - soc
            for s in slots:
                cap_e = min(s.speed_kw * s.dwell_min / 60.0, headroom)
                top = _q(soc + cap_e, capacity)
                for b2 in range(soc_b + 1, top + 1):     # how much to add
                    fill = _dq(b2, capacity) - soc
                    money = fill * s.price
                    edge = detour_cost(s.detour_km) + care * money
                    act = ("charge", day, label, s.station, fill,
                           fill / s.speed_kw * 60.0, s.detour_km, money, s.source)
                    relax((b2, k + 1), cost + edge, act)

        dp = ndp

    # must end full; add the convex session penalty once, at the end
    best = None
    for (soc_b, k), cost in dp.items():
        if soc_b != cap_b:
            continue
        total = cost + session_penalty(k)
        if best is None or total < best[0]:
            best = (total, k, (soc_b, k))
    if best is None:
        return None

    # walk backpointers to recover the chosen actions
    _, k, state = best
    actions, layer = [], len(events)
    while back[(layer, *state)] is not None:
        layer, state, act = back[(layer, *state)]
        actions.append(act)
    actions.reverse()
    return {"sessions": k, "actions": actions, "care": care}


def optimize(backend, home=None, locations=None, care=COST_CARE):
    """Run the full pipeline.

    Returns (plan, capacity, weekly_km, weekly_kwh, distances) where `distances`
    is the per-day {DayOfWeek: km} the API exposes as weekly_distance.

    home/locations default to the backend's own data (handy for the CLI); the
    API passes the user's placed points instead.
    """
    if home is None:
        home = backend.get_home()
    if locations is None:
        locations = backend.get_locations_list()
    distances = backend.estimate_distance(home, locations)

    weekly_km = sum(distances.values())
    weekly_kwh = weekly_km * CONSUMPTION_KWH_PER_KM
    capacity = weekly_kwh / (1.0 - FLOOR_FRACTION) * (1.0 + SIZING_MARGIN)
    floor_kwh = FLOOR_FRACTION * capacity

    events = build_events(backend, home, locations, distances)
    plan = solve(events, capacity, floor_kwh, float(care))
    return plan, capacity, weekly_km, weekly_kwh, distances


def chosen_charging_stations(plan):
    """The stations the optimizer actually picked, in the frontend's shape:
    one entry per charging session, tagged with the day it happens."""
    if plan is None:
        return []
    stations = []
    for a in plan["actions"]:
        if a[0] != "charge":
            continue
        day, source = a[1], a[8]
        stations.append({
            "lat": source.lat,
            "long": source.long,
            "charger_type": source.charger_type.name,
            "charger_kilowatts": source.charger_kilowatts,
            "distance_to_location": source.distance_to_location,
            "visit_day": day.name,
        })
    print(stations)
    return stations


def report(plan, capacity, weekly_km, weekly_kwh):
    print("EV weekly charging plan")
    print(f"  weekly {weekly_km:.0f} km / {weekly_kwh:.1f} kWh   "
          f"battery {capacity:.1f} kWh   floor {FLOOR_FRACTION * 100:.0f}%")
    if plan is None:
        print("  -> infeasible (not enough reachable charging)")
        return

    detour_km = detour_pen = money = 0.0
    for a in plan["actions"]:
        if a[0] != "charge":
            continue
        _, day, label, station, fill, dur, det, eur, _src = a
        detour_km += det
        detour_pen += detour_cost(det)
        money += eur
        print(f"  {day.name:<9} charge {label:<6} @ {station:<16} "
              f"+{fill:4.1f} kWh / {dur:4.0f} min   detour {det:4.1f} km   "
              f"EUR {eur:4.2f}")

    k = plan["sessions"]
    objective = detour_pen + session_penalty(k) + plan["care"] * money
    print(f"  sessions {k} | detour {detour_km:.1f} km ({detour_pen:.1f} pen) | "
          f"penalty {session_penalty(k):.1f} km | cost EUR {money:.2f} | "
          f"objective {objective:.1f}")
