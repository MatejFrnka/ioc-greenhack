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
