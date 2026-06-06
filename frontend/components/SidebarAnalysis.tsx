import BatteryChart from "@/components/BatteryChart";
import CostBarChart from "@/components/CostBarChart";
import {
  BATTERY_CAPACITY_OPTIONS,
  chargingStationKey,
  formatVisitDay,
  totalWeeklyKm,
  type PlanResponse,
} from "@/lib/plan";

interface SidebarAnalysisProps {
  plan: PlanResponse | null;
  planLoading: boolean;
  planError: string | null;
  batteryCapacity: number;
  onBatteryCapacityChange: (kwh: number) => void;
  onHoverChargingStation: (key: string | null) => void;
}

function HighlightStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-3.5">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span className="material-icons text-[18px] leading-none">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-3xl font-bold tracking-tight text-zinc-900">
        {value}
      </p>
    </div>
  );
}

export default function SidebarAnalysis({
  plan,
  planLoading,
  planError,
  batteryCapacity,
  onBatteryCapacityChange,
  onHoverChargingStation,
}: SidebarAnalysisProps) {
  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Analysis</h2>
        <p className="mt-1.5 text-sm text-zinc-500">
          Your weekly EV charging plan based on your locations.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-500">
          Battery capacity
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BATTERY_CAPACITY_OPTIONS.map((option) => {
            const isActive = batteryCapacity === option.kwh;
            return (
              <button
                key={option.kwh}
                type="button"
                disabled={planLoading}
                onClick={() => onBatteryCapacityChange(option.kwh)}
                aria-pressed={isActive}
                className={`flex flex-col items-center rounded-xl border px-2 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? "border-primary bg-primary/10 text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-zinc-500">{option.kwh} kWh</span>
              </button>
            );
          })}
        </div>
      </div>

      {planLoading && (
        <p className="text-sm text-zinc-500">Loading analysis…</p>
      )}

      {planError && <p className="text-sm text-red-600">{planError}</p>}

      {!planLoading && !planError && !plan && (
        <p className="text-sm text-zinc-500">
          Set your home address to run an analysis.
        </p>
      )}

      {plan && !planError && (
        <div className="flex flex-col gap-4">
          <HighlightStat
            icon="route"
            label="Weekly distance"
            value={`${totalWeeklyKm(plan.weekly_distance).toFixed(1)} km`}
          />
          <HighlightStat
            icon="alarm"
            label="Extra time taken"
            value={`${plan.extra_walk_time} min`}
          />
          <div>
            <p className="mb-1 text-sm text-zinc-500">Fuel vs electricity</p>
            <CostBarChart
              fuel={plan.fuel_price}
              electricity={plan.electricity_price}
            />
          </div>
        </div>
      )}

      {plan && !planError && (plan.soc_trajectory ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Battery level over the week
          </h3>
          <BatteryChart trajectory={plan.soc_trajectory} />
        </div>
      )}

      {plan && !planError && plan.charging_stations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Charging sessions
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {plan.charging_stations.map((station, index) => {
              const key = chargingStationKey(station, index);
              const isDc = station.charger_type === "DC";
              return (
                <li
                  key={key}
                  onMouseEnter={() => onHoverChargingStation(key)}
                  onMouseLeave={() => onHoverChargingStation(null)}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2.5 transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: isDc ? "#16a34a" : "#ca8a04" }}
                  >
                    <span className="material-icons text-[18px] leading-none">
                      ev_station
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-900">
                        {formatVisitDay(station.visit_day)}
                      </span>
                      <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        {station.charger_kilowatts}kW {station.charger_type}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-700">
                        {station.charged_kwh.toFixed(1)} kWh
                      </span>
                      <span className="text-zinc-300">·</span>
                      <span>{Math.round(station.charge_minutes)} min</span>
                      <span className="text-zinc-300">·</span>
                      <span>
                        {station.distance_to_location.toFixed(1)} km away
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
