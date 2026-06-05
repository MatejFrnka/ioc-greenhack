from flask import Flask, jsonify, request
from flask_cors import CORS

from .location import DayOfWeek, Location
from .concreate import ConcreateBackend
from .optimizer import optimize, chosen_charging_stations

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

    result, *_ = optimize(backend, home=home, locations=locations)
    return jsonify({"charging_stations": chosen_charging_stations(result)})


if __name__ == "__main__":
    app.run(port=5003, debug=True)
