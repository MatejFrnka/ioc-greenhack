import type { MapPoint, PointType } from "@/lib/map-points";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

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

export interface ChargingStation {
  lat: number;
  long: number;
  charger_type: "AC" | "DC";
  charger_kilowatts: number;
  distance_to_location: number;
  visit_day: DayOfWeek | null;
}

export interface PlanResponse {
  charging_stations: ChargingStation[];
  weekly_distance: Record<DayOfWeek, number>;
  fuel_price: number;
  electricity_price: number;
  extra_walk_time: number;
}

const WEEKDAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

const WEEKEND: DayOfWeek[] = ["SATURDAY", "SUNDAY"];

const DEFAULT_VISITS: Record<PointType, DayOfWeek[]> = {
  home: [],
  work: WEEKDAYS,
  school: WEEKDAYS,
  shopping_cart: WEEKEND,
  question_mark: ["WEDNESDAY"],
};

const DEFAULT_TIME_SPENT: Record<PointType, number> = {
  home: 720,
  work: 480,
  school: 360,
  shopping_cart: 60,
  question_mark: 120,
};

function pointToLocation(point: MapPoint): PlanLocation {
  return {
    lat: point.lat,
    long: point.lng,
    time_spent: DEFAULT_TIME_SPENT[point.type],
    visits: DEFAULT_VISITS[point.type],
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function fetchPlan(
  request: PlanRequest,
  signal?: AbortSignal
): Promise<PlanResponse> {
  const response = await fetch(`${API_BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Plan request failed (${response.status})`);
  }

  return response.json() as Promise<PlanResponse>;
}

export function formatVisitDay(day: DayOfWeek | null): string {
  if (!day) return "—";
  return day.charAt(0) + day.slice(1, 3).toLowerCase();
}

export function chargingStationKey(station: ChargingStation, index: number): string {
  return `${station.lat},${station.long},${station.charger_kilowatts},${index}`;
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
