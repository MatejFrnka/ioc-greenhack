import type { DayOfWeek, MapPoint, PointType } from "@/lib/map-points";

export type { DayOfWeek };

export interface PlanLocation {
  lat: number;
  long: number;
  time_spent: number;
  visits: DayOfWeek[];
}

export interface PlanRequest {
  home: PlanLocation;
  locations: PlanLocation[];
}

export const BATTERY_CAPACITY_OPTIONS = [
  { label: "Small", kwh: 40 },
  { label: "Mid", kwh: 60 },
  { label: "Large", kwh: 80 },
] as const;

export const DEFAULT_BATTERY_KWH = 60;

export type BatteryCapacityKwh =
  (typeof BATTERY_CAPACITY_OPTIONS)[number]["kwh"];

export interface StationInRange {
  lat: number;
  long: number;
  charger_type: "AC" | "DC" | "UNKNOWN";
  charger_kilowatts: number;
  distance_to_location: number;
}

export interface ChargingStation {
  lat: number;
  long: number;
  charger_type: "AC" | "DC";
  charger_kilowatts: number;
  distance_to_location: number;
  visit_day: DayOfWeek | null;
  charged_kwh: number;
  charge_minutes: number;
}

export interface PathPoint {
  lat: number;
  lng: number;
}

export interface PathFromHome {
  distance: number;
  travel_time?: number;
  path: PathPoint[];
}

export interface SocPoint {
  index: number;
  day: DayOfWeek;
  kwh: number;
  kind: "start" | "drive" | "charge";
}

export interface PlanResponse {
  charging_stations: ChargingStation[];
  stations_in_range: StationInRange[];
  weekly_distance: Record<DayOfWeek, number>;
  daily_peak_kwh: Record<DayOfWeek, number>;
  soc_trajectory: SocPoint[];
  fuel_price: number;
  electricity_price: number;
  extra_walk_time: number;
  paths_from_home: PathFromHome[];
  paths_from_stations: PathFromHome[];
  feasible?: boolean;
  reason?: string | null;
}

/** `/api/plan` returns one scenario per battery size (keys `"40"`, `"60"`, `"80"`). */
export type PlanResponseByCapacity = Record<
  `${BatteryCapacityKwh}`,
  PlanResponse
>;

export const ALL_DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const WEEKDAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

const WEEKEND: DayOfWeek[] = ["SATURDAY", "SUNDAY"];

export const DEFAULT_VISITS: Record<PointType, DayOfWeek[]> = {
  home: [],
  work: WEEKDAYS,
  school: WEEKDAYS,
  shopping_cart: WEEKEND,
  question_mark: ["WEDNESDAY"],
};

export const DEFAULT_TIME_SPENT_MINUTES: Record<PointType, number> = {
  home: 720,
  work: 480,
  school: 30,
  shopping_cart: 60,
  question_mark: 120,
};

export function defaultHoursForType(type: PointType): number {
  return DEFAULT_TIME_SPENT_MINUTES[type] / 60;
}

function pointToLocation(point: MapPoint): PlanLocation {
  return {
    lat: point.lat,
    long: point.lng,
    time_spent: point.timeSpentMinutes,
    visits: point.visits,
  };
}

export function pointsToPlanRequest(points: MapPoint[]): PlanRequest | null {
  const homePoint = points.find((point) => point.type === "home");
  if (!homePoint) return null;

  return {
    home: pointToLocation(homePoint),
    locations: points
      .filter((point) => point.type !== "home")
      .map(pointToLocation),
  };
}

export function planForBatteryCapacity(
  plans: PlanResponseByCapacity,
  kwh: number
): PlanResponse | null {
  return plans[String(kwh) as `${BatteryCapacityKwh}`] ?? null;
}

export const CHARGING_STATION_DC_COLOR = "#16a34a";
export const CHARGING_STATION_AC_COLOR = "#ca8a04";

/** `[lat, long]` tuples from `/api/stations`. */
export type StationCoordinate = [number, number];

export async function fetchPlan(
  request: PlanRequest,
  signal?: AbortSignal
): Promise<PlanResponseByCapacity> {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Plan request failed (${response.status})`);
  }

  return response.json() as Promise<PlanResponseByCapacity>;
}

export async function fetchStations(
  signal?: AbortSignal
): Promise<StationCoordinate[]> {
  const response = await fetch("/api/stations", { signal });

  if (!response.ok) {
    throw new Error(`Stations request failed (${response.status})`);
  }

  return response.json() as Promise<StationCoordinate[]>;
}

export function formatVisitDay(day: DayOfWeek | null): string {
  if (!day) return "—";
  return day.charAt(0) + day.slice(1, 3).toLowerCase();
}

export function chargingStationKey(station: ChargingStation, index: number): string {
  return `${station.lat},${station.long},${station.charger_kilowatts},${index}`;
}

export function stationInRangeKey(station: StationInRange, index: number): string {
  return `in-range:${station.lat},${station.long},${station.charger_kilowatts},${index}`;
}

export function dedupeStationsInRange(
  stations: StationInRange[]
): StationInRange[] {
  const seen = new Map<string, StationInRange>();
  for (const station of stations) {
    const key = `${station.lat},${station.long},${station.charger_type},${station.charger_kilowatts}`;
    const existing = seen.get(key);
    if (
      !existing ||
      station.distance_to_location < existing.distance_to_location
    ) {
      seen.set(key, station);
    }
  }
  return [...seen.values()];
}

export function formatStationInRangeDistance(km: number): string {
  return km < 1 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

export function totalWeeklyKm(
  weeklyDistance: Record<DayOfWeek, number>
): number {
  return Object.values(weeklyDistance).reduce((sum, distance) => sum + distance, 0);
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatWeeklyCzk(amount: number): string {
  return `${czkFormatter.format(amount)}/week`;
}
