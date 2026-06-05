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


class ChargerType(enum.Enum):
    AC = 0
    DC = 1
    UNKNOWN = -1


@dataclasses.dataclass
class ChargingStation:
    lat: float
    long: float
    charger_type: ChargerType
    charger_kilowatts: int  # kw
    distance_to_location: float
