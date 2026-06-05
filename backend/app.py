from dataclasses import asdict

from flask import Flask, jsonify, request
from flask_cors import CORS

from .location import DayOfWeek, Location
from .mock import MockBackend

app = Flask(__name__)
CORS(app)
backend = MockBackend()


def location_from_json(data: dict) -> Location:
    return Location(
        lat=data["lat"],
        long=data["long"],
        time_spent=data["time_spent"],
        visits=[DayOfWeek[day] for day in data.get("visits", [])],
    )


def plan_to_dict(result: dict) -> dict:
    return {
        "charging_stations": [asdict(station) for station in result["charging_stations"]],
        "visit_day": result["visit_day"].name,
        "weekly_distance": {
            day.name: distance for day, distance in result["weekly_distance"].items()
        },
    }


@app.post("/api/plan")
def plan():
    data = request.json
    home = location_from_json(data["home"])
    locations = [location_from_json(loc) for loc in data["locations"]]
    return jsonify(plan_to_dict(backend.plan(home, locations)))


if __name__ == "__main__":
    app.run(port=5000, debug=True)
