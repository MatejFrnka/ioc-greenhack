import {
  PLACEMENT_POINT_TYPES,
  POINT_TYPE_CONFIG,
  type MapPoint,
} from "@/lib/map-points";
import {
  chargingStationKey,
  formatVisitDay,
  formatWeeklyCzk,
  totalWeeklyKm,
  type PlanResponse,
} from "@/lib/plan";

interface MapPanelProps {
  points: MapPoint[];
  plan: PlanResponse | null;
  planLoading: boolean;
  planError: string | null;
  onNavigate: (point: MapPoint) => void;
  onDelete: (id: string) => void;
}

function sortPoints(points: MapPoint[]): MapPoint[] {
  return [...points].sort(
    (a, b) =>
      PLACEMENT_POINT_TYPES.indexOf(a.type) -
      PLACEMENT_POINT_TYPES.indexOf(b.type)
  );
}

function PlanStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

export default function MapPanel({
  points,
  plan,
  planLoading,
  planError,
  onNavigate,
  onDelete,
}: MapPanelProps) {
  const sortedPoints = sortPoints(points);
  const hasHome = points.some((point) => point.type === "home");
  const chargingStations = plan?.charging_stations ?? [];

  return (
    <div className="absolute top-24 right-4 z-10 flex max-h-[calc(100%-7rem)] w-72 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-lg backdrop-blur-sm">
      <div className="shrink-0 border-b border-zinc-100 p-3">
        <h2 className="text-sm font-semibold text-zinc-900">Places</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Click to view on map</p>
      </div>

      <div className="min-h-0 overflow-y-auto p-2">
        {sortedPoints.length === 0 ? (
          <p className="px-2 py-2 text-xs text-zinc-500">
            Tap the map to add home, work, and other stops.
          </p>
        ) : (
          <ul className="space-y-1">
            {sortedPoints.map((point) => {
              const { icon, label, color, foreground } =
                POINT_TYPE_CONFIG[point.type];

              return (
                <li key={point.id}>
                  <div className="group flex items-center gap-1 rounded-lg hover:bg-zinc-50">
                    <button
                      type="button"
                      onClick={() => onNavigate(point)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm"
                        style={{
                          backgroundColor: color,
                          color: foreground,
                        }}
                      >
                        <span className="material-icons text-[15px] leading-none">
                          {icon}
                        </span>
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                        {label}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(point.id);
                      }}
                      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <span className="material-icons text-[17px] leading-none">
                        delete
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasHome && (
        <>
          {plan && !planError && (
            <div className="shrink-0 border-t border-zinc-100 p-3">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900">
                Plan summary
              </h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <PlanStat
                  label="Weekly distance"
                  value={`${totalWeeklyKm(plan.weekly_distance).toFixed(1)} km`}
                />
                <PlanStat
                  label="Extra walk"
                  value={`${plan.extra_walk_time} min`}
                />
                <PlanStat
                  label="Fuel (week)"
                  value={formatWeeklyCzk(plan.fuel_price)}
                />
                <PlanStat
                  label="Electricity (week)"
                  value={formatWeeklyCzk(plan.electricity_price)}
                />
              </dl>
            </div>
          )}

          <div className="shrink-0 border-t border-zinc-100 p-3 pb-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Charging stations
              </h2>
              {planLoading && (
                <span className="text-xs text-zinc-500">Loading…</span>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-3 pb-3">
            {planError && (
              <p className="text-xs text-red-600">{planError}</p>
            )}
            {!planError && chargingStations.length === 0 && !planLoading && (
              <p className="text-xs text-zinc-500">No stations found.</p>
            )}
            {!planError && chargingStations.length > 0 && (
              <ul className="space-y-2">
                {chargingStations.map((station, index) => (
                  <li
                    key={chargingStationKey(station, index)}
                    className="flex items-start gap-2 text-xs text-zinc-700"
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-white"
                      style={{
                        backgroundColor:
                          station.charger_type === "DC" ? "#16a34a" : "#ca8a04",
                      }}
                    >
                      <span className="material-icons text-[12px] leading-none">
                        ev_station
                      </span>
                    </span>
                    <span>
                      <span className="font-medium text-zinc-900">
                        {station.charger_kilowatts}kW {station.charger_type}
                      </span>
                      <span className="text-zinc-500">
                        {" "}
                        · {formatVisitDay(station.visit_day)} ·{" "}
                        {station.distance_to_location.toFixed(1)} km
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
