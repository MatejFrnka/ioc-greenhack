from flask import Flask, jsonify, request
from flask_cors import CORS

from .location import DayOfWeek, Location
from .concreate import ConcreateBackend
from .optimizer import optimize, chosen_charging_stations, daily_peak_kwh
from .config import (ELECTRICITY_PRICE_CZK_PER_KWH, FUEL_PRICE_CZK_PER_L,
                     PETROL_L_PER_100KM, WALK_SPEED_KMPH)

app = Flask(__name__)
CORS(app)
backend = ConcreateBackend()


def location_from_json(data: dict) -> Location:
    return Location(
        lat=data["lat"],
        long=data["long"],
        time_spent=data["time_spent"],
        visits=[DayOfWeek[day] for day in data.get("visits", [])],
    )


def solution(home, locations, battery_kwh):
    result, capacity, weekly_km, weekly_kwh, distances, reason = optimize(
        backend, home=home, locations=locations, battery_kwh=battery_kwh
    )

    # weekly running cost (CZK): the EV's energy vs the same week in a petrol car
    electricity_weekly_czk = weekly_kwh * ELECTRICITY_PRICE_CZK_PER_KWH
    fuel_weekly_czk = weekly_km * (PETROL_L_PER_100KM / 100.0) * FUEL_PRICE_CZK_PER_L

    # extra walking (min/week): for every charge, walk from the station to the
    # destination and back (2x its distance), at WALK_SPEED_KMPH.
    stations = chosen_charging_stations(result)
    walk_km = sum(s["distance_to_location"] for s in stations) * 2.0
    extra_walk_time = round(walk_km / WALK_SPEED_KMPH * 60.0)

    stations_result = [s.copy() for s in stations]
    for s in stations_result:
        del s['location_from']

    stations_in_range = backend.best_charging_stations(home)
    for loc in locations:
        stations_in_range += backend.best_charging_stations(loc)

    return {
        "charging_stations": stations_result,
        "weekly_distance": {day.name: km for day, km in distances.items()},
        "daily_peak_kwh": {
            day.name: kwh for day, kwh in daily_peak_kwh(result, capacity).items()
        },
        "fuel_price": round(fuel_weekly_czk),
        "electricity_price": round(electricity_weekly_czk),
        "extra_walk_time": extra_walk_time,
        "feasible": result is not None,
        "reason": reason,
        "paths_from_home": [backend.drive_path(home, loc) for loc in locations],
        "paths_from_stations": [backend.walking_path(s['location_from'], (s['lat'], s['long'])) for s in stations],
        "stations_in_range": stations_in_range,
    }


@app.post("/api/plan")
def plan():
    data = request.json
    home = location_from_json(data["home"])
    locations = [location_from_json(loc) for loc in data["locations"]]
    # battery_kwh = data.get("battery_kwh")  # user-chosen pack size (Small/Mid/Large)

    return jsonify({
        battery_kwh: solution(home, locations, battery_kwh) for battery_kwh in [40, 60, 80]
    })


@app.get("/api/stations")
def stations():
    return backend.charging_stations()


if __name__ == "__main__":
    app.run(port=5003, debug=True)
