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
    def charging_stations(self) -> list[tuple[float, float]]:
        pass

    @abc.abstractmethod
    def distance(self, a: Location, b: Location) -> float:
        """One-way distance a<->b in km (used for per-leg drive events)."""
        pass

    @abc.abstractmethod
    def walking_path(self, location: Location, charger: tuple[float, float]):
        pass

    @abc.abstractmethod
    def drive_path(self, location_from: Location, location_to: Location):
        pass
