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

from .location import DayOfWeek, Location
from .config import (CONSUMPTION_KWH_PER_KM, FLOOR_FRACTION, END_FRACTION, BATTERY_KWH,
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
    location_from: Location


def _slots_at(backend, point, label):
    """Ways to charge while parked at `point`: one per reachable station."""
    return [
        Slot(label, f"{s.charger_type.name}{s.charger_kilowatts}kW",
             s.charger_kilowatts, point.time_spent,
             s.distance_to_location, price_per_kwh(s.charger_kilowatts), s, point)
        for s in backend.best_charging_stations(point)
    ]


def build_events(backend, home, locations):
    """Chronological list of ('drive', day, kWh) and ('park', day, label, slots).

    Each visited location is an independent round trip from home:
        drive out -> PARK at the stop (can charge) -> drive back.
    Charging happens only while parked at a stop or at home -- never en route --
    so the destination's own charger is what enables the return leg.
    """
    home_slots = _slots_at(backend, home, "Home")
    events = []
    for d in DayOfWeek:
        for i, loc in enumerate(locations):
            if d not in loc.visits:
                continue
            leg_kwh = backend.distance(home, loc) * CONSUMPTION_KWH_PER_KM
            label = f"Stop {i + 1}"
            events.append(("drive", d, leg_kwh))                       # home -> stop
            events.append(("park", d, label, _slots_at(backend, loc, label)))
            events.append(("drive", d, leg_kwh))                       # stop -> home
        events.append(("park", d, "Home", home_slots))                # end the day home
    return events


# --- DP state = (event index, SoC bucket, #sessions); SoC discretized -----------
def _q(soc, cap):
    return min(int(round(soc / SOC_STEP_KWH)), int(round(cap / SOC_STEP_KWH)))


def _dq(b, cap):
    return min(b * SOC_STEP_KWH, cap)


def solve(events, capacity, floor_kwh, end_kwh, care):
    cap_b = _q(capacity, capacity)          # "full" = the top SoC bucket (start state)
    end_b = _q(end_kwh, capacity)           # required SoC at the end of the week
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
                           fill / s.speed_kw * 60.0, s.detour_km, money, s.source, s.location_from)
                    relax((b2, k + 1), cost + edge, act)

        dp = ndp

    # must end at >= END_FRACTION; add the convex session penalty once, at the end
    best = None
    for (soc_b, k), cost in dp.items():
        if soc_b < end_b:
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


def infeasible_reason(backend, home, locations, capacity):
    """A human-readable explanation for why no plan exists (charging only at stops)."""
    usable_kwh = capacity * (1.0 - FLOOR_FRACTION)
    usable_km = usable_kwh / CONSUMPTION_KWH_PER_KM
    floor_pct = int(FLOOR_FRACTION * 100)
    for i, loc in enumerate(locations):
        oneway_km = backend.distance(home, loc)
        oneway_kwh = oneway_km * CONSUMPTION_KWH_PER_KM
        if oneway_kwh > usable_kwh + 1e-9:
            return (f"Stop {i + 1} is {oneway_km:.0f} km away: one leg needs "
                    f"{oneway_kwh:.0f} kWh, but only {usable_kwh:.0f} kWh "
                    f"({usable_km:.0f} km) is usable above the {floor_pct}% floor. "
                    f"Out of range without en-route charging.")
        if not backend.best_charging_stations(loc) and 2 * oneway_kwh > usable_kwh + 1e-9:
            return (f"Stop {i + 1} is {oneway_km:.0f} km away and has no charger "
                    f"nearby, so the battery can't be refilled for the "
                    f"{2 * oneway_km:.0f} km round trip "
                    f"(only {usable_km:.0f} km usable above the floor).")
    return ("Couldn't keep the battery above the floor on some leg, with charging "
            "only at the stops.")


def end_of_week_charge(backend, home, locations, capacity, weekly_kwh):
    """Recommend a single charge for a week so light the car never had to charge.

    Picks the best reachable station, preferring home (charge on Sunday night),
    and tops the battery back toward full. Returns a 'charge' action, or None if
    no station is reachable anywhere.
    """
    end_day = list(DayOfWeek)[-1]            # Sunday = end of the week
    candidates = [(home, "Home")] + [(loc, f"Stop {i + 1}")
                                     for i, loc in enumerate(locations)]
    for point, label in candidates:
        stations = backend.best_charging_stations(point)
        if not stations:
            continue
        s = stations[0]                      # best by the backend's ordering
        fill = min(weekly_kwh, s.charger_kilowatts * point.time_spent / 60.0, capacity)
        money = fill * price_per_kwh(s.charger_kilowatts)
        return ("charge", end_day, label,
                f"{s.charger_type.name}{s.charger_kilowatts}kW", fill,
                fill / s.charger_kilowatts * 60.0, s.distance_to_location, money, s, home)
    return None


def optimize(backend, home=None, locations=None, care=COST_CARE, battery_kwh=None):
    """Run the full pipeline.

    Returns (plan, capacity, weekly_km, weekly_kwh, distances, reason). `distances`
    is the per-day {DayOfWeek: km} the API exposes as weekly_distance; `reason` is
    None when feasible, else a human-readable cause.

    home/locations default to the backend's own data (handy for the CLI); the
    API passes the user's placed points instead. `battery_kwh` overrides the
    config pack size (the user picks Small/Mid/Large in the UI).
    """
    if home is None:
        home = backend.get_home()
    if locations is None:
        locations = backend.get_locations_list()
    distances = backend.estimate_distance(home, locations)

    weekly_km = sum(distances.values())
    weekly_kwh = weekly_km * CONSUMPTION_KWH_PER_KM
    capacity = float(battery_kwh) if battery_kwh else float(BATTERY_KWH)  # the pack; the floor below binds
    floor_kwh = FLOOR_FRACTION * capacity
    end_kwh = END_FRACTION * capacity     # required level at the end of the week

    events = build_events(backend, home, locations)
    plan = solve(events, capacity, floor_kwh, end_kwh, float(care))
    reason = None if plan is not None else infeasible_reason(
        backend, home, locations, capacity)

    # Light week: the car never had to charge -> still recommend one charge at week's end.
    if plan is not None and not any(a[0] == "charge" for a in plan["actions"]):
        extra = end_of_week_charge(backend, home, locations, capacity, weekly_kwh)
        if extra is not None:
            plan["actions"].append(extra)
            plan["sessions"] = 1

    return plan, capacity, weekly_km, weekly_kwh, distances, reason


def chosen_charging_stations(plan):
    """The stations the optimizer actually picked, in the frontend's shape:
    one entry per charging session, tagged with the day it happens."""
    if plan is None:
        return []
    stations = []
    for a in plan["actions"]:
        if a[0] != "charge":
            continue
        day, fill, duration, source = a[1], a[4], a[5], a[8]
        stations.append({
            "lat": source.lat,
            "long": source.long,
            "charger_type": source.charger_type.name,
            "charger_kilowatts": source.charger_kilowatts,
            "distance_to_location": source.distance_to_location,
            "visit_day": day.name,
            "charged_kwh": round(fill, 2),       # how much energy this session adds
            "charge_minutes": round(duration, 1),
            'location_from': a[9],
        })
    print(stations)
    return stations


def daily_peak_kwh(plan, capacity):
    """Highest battery level (kWh) reached on each day, replaying the plan from full.

    The level carried into a day counts too, so a quiet day's peak is just the
    level it started with. Returns {DayOfWeek: kWh} for the whole week.
    """
    if plan is None:
        return {}
    by_day = {d: [] for d in DayOfWeek}
    for a in plan["actions"]:                # actions are already chronological
        if a[0] in ("drive", "charge"):
            by_day[a[1]].append(a)

    peak, soc = {}, capacity                 # the week starts at a full battery
    for d in DayOfWeek:
        day_peak = soc                       # the level carried into the day
        for a in by_day[d]:
            if a[0] == "drive":
                soc -= a[2]
            else:
                soc = min(soc + a[4], capacity)   # can't charge past 100%
            day_peak = max(day_peak, soc)
        peak[d] = round(day_peak, 1)
    return peak


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
