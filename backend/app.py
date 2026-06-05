from flask import Flask, jsonify, request
from flask_cors import CORS

from .location import DayOfWeek, Location
from .concreate import ConcreateBackend
from .optimizer import optimize, chosen_charging_stations, daily_remaining_kwh
from .config import (ELECTRICITY_PRICE_CZK_PER_KWH, FUEL_PRICE_CZK_PER_L,
                     PETROL_L_PER_100KM, EXTRA_WALK_TIME)

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


@app.post("/api/plan")
def plan():
    data = request.json
    home = location_from_json(data["home"])
    locations = [location_from_json(loc) for loc in data["locations"]]

    result, capacity, weekly_km, weekly_kwh, distances, reason = optimize(
        backend, home=home, locations=locations
    )

    # weekly running cost (CZK): the EV's energy vs the same week in a petrol car
    electricity_weekly_czk = weekly_kwh * ELECTRICITY_PRICE_CZK_PER_KWH
    fuel_weekly_czk = weekly_km * (PETROL_L_PER_100KM / 100.0) * FUEL_PRICE_CZK_PER_L

    return jsonify({
        "charging_stations": chosen_charging_stations(result),
        "weekly_distance": {day.name: km for day, km in distances.items()},
        "daily_remaining_kwh": {
            day.name: kwh for day, kwh in daily_remaining_kwh(result, capacity).items()
        },
        "fuel_price": round(fuel_weekly_czk),
        "electricity_price": round(electricity_weekly_czk),
        "extra_walk_time": EXTRA_WALK_TIME,
        "feasible": result is not None,
        "reason": reason,
    })


@app.get("/api/stations")
def stations():
    return backend.charging_stations()


if __name__ == "__main__":
    app.run(port=5003, debug=True)
