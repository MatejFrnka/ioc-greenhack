from .backend import Backend
from .location import Location, DayOfWeek, ChargingStation, ChargerType


class MockBackend(Backend):
    def best_charging_stations(self, location: Location) -> list[ChargingStation]:
        return [
            ChargingStation(
                lat=50.0812,
                long=14.4205,
                charger_type=ChargerType.DC,
                charger_kilowatts=150,
                distance_to_location=0.4,
            ),
            ChargingStation(
                lat=50.0895,
                long=14.4170,
                charger_type=ChargerType.DC,
                charger_kilowatts=50,
                distance_to_location=1.0,
            ),
            ChargingStation(
                lat=50.0701,
                long=14.4503,
                charger_type=ChargerType.AC,
                charger_kilowatts=22,
                distance_to_location=2.5,
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
        stations = self.best_charging_stations(home)
        return {
            "charging_stations": [
                {"station": stations[0], "visit_day": DayOfWeek.WEDNESDAY},
                {"station": stations[1], "visit_day": None},
                {"station": stations[2], "visit_day": DayOfWeek.FRIDAY},
            ],
            "weekly_distance": self.estimate_distance(home, locations),
            "fuel_price": 1045,
            "electricity_price": 285,
            "extra_walk_time": 12,
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

