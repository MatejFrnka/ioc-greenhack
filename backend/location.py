import enum
import dataclasses


class DayOfWeek(enum.Enum):
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


@dataclasses.dataclass
class Location:
    lat: float
    long: float
    time_spent: int  # in minutes
    visits: list[DayOfWeek]


@dataclasses.dataclass
class ChargingStation:
    lat: float
    long: float
    charger_type: str
    cost_value: float
