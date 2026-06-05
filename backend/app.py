from flask import Flask, jsonify, request
from flask_cors import CORS

from .location import DayOfWeek, Location
from .concreate import ConcreateBackend
from .optimizer import optimize, chosen_charging_stations
from .config import FUEL_PRICE, ELECTRICITY_PRICE, EXTRA_WALK_TIME

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

    result, _capacity, _wkm, _wkwh, distances = optimize(
        backend, home=home, locations=locations
    )

    return jsonify({
        "charging_stations": chosen_charging_stations(result),
        "weekly_distance": {day.name: km for day, km in distances.items()},
        "fuel_price": FUEL_PRICE,
        "electricity_price": ELECTRICITY_PRICE,
        "extra_walk_time": EXTRA_WALK_TIME,
    })


if __name__ == "__main__":
    app.run(port=5003, debug=True)
