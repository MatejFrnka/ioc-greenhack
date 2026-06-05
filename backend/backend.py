import abc
from .location import Location, DayOfWeek, ChargingStation


class Backend(abc.ABC):
    @abc.abstractmethod
    def best_charging_stations(self, location: Location) -> list[ChargingStation]:
        pass

    @abc.abstractmethod
    def estimate_distance(self, home: Location, locations: list[Location]) -> dict[DayOfWeek, float]:
        pass

    @abc.abstractmethod
    def distance(self, a: Location, b: Location) -> float:
        """One-way distance a<->b in km (used for per-leg drive events)."""
        pass
