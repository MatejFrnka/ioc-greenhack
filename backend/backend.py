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
