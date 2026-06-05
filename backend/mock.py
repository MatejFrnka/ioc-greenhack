from .backend import Backend
from .location import Location, DayOfWeek, ChargingStation


class MockBackend(Backend):
    def best_charging_stations(self, location: Location) -> list[ChargingStation]:
        return [
            ChargingStation(
                lat=50.0812,
                long=14.4205,
                charger_type="DC Fast 150kW",
                cost_value=0.39,
            ),
            ChargingStation(
                lat=50.0895,
                long=14.4170,
                charger_type="DC Fast 50kW",
                cost_value=0.31,
            ),
            ChargingStation(
                lat=50.0701,
                long=14.4503,
                charger_type="AC Type 2 22kW",
                cost_value=0.22,
            ),
        ]

    def estimate_distance(self, home: Location, locations: list[Location]) -> dict[DayOfWeek, float]:
        base = {
            DayOfWeek.MONDAY: 10.0,
            DayOfWeek.TUESDAY: 12.5,
            DayOfWeek.WEDNESDAY: 9.0,
            DayOfWeek.THURSDAY: 11.2,
            DayOfWeek.FRIDAY: 13.7,
            DayOfWeek.SATURDAY: 6.3,
            DayOfWeek.SUNDAY: 5.1,
        }

        # crude adjustment: more locations => slightly higher travel
        factor = 1 + (len(locations) * 0.05)

        return {day: dist * factor for day, dist in base.items()}

    def get_home(self) -> Location:
        return Location(
            lat=50.0756,
            long=14.437,
            time_spent=720,
            visits=[]
        )

    def plan(self, home: Location, locations: list[Location]) -> dict:
        return {
            "charging_stations": self.best_charging_stations(home),
            "visit_day": DayOfWeek.WEDNESDAY,
            "weekly_distance": self.estimate_distance(home, locations),
        }

    def get_locations_list(self) -> list[Location]:
        return [
            Location(
                lat=50.0755,
                long=14.4378,
                time_spent=480,
                visits=[
                    DayOfWeek.MONDAY,
                    DayOfWeek.TUESDAY,
                    DayOfWeek.WEDNESDAY,
                    DayOfWeek.THURSDAY,
                    DayOfWeek.FRIDAY,
                ],
            ),
            Location(
                lat=50.0880,
                long=14.4208,
                time_spent=60,
                visits=[DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
            ),
            Location(
                lat=50.0598,
                long=14.4466,
                time_spent=120,
                visits=[DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY],
            ),
            Location(
                lat=50.1025,
                long=14.3899,
                time_spent=30,
                visits=[DayOfWeek.MONDAY, DayOfWeek.THURSDAY],
            ),
        ]

