import {
  ALL_DAYS,
  DAY_SHORT_LABELS,
  chargingStationKey,
  formatVisitDay,
  formatWeeklyCzk,
  totalWeeklyKm,
  type PlanResponse,
} from "@/lib/plan";

interface SidebarAnalysisProps {
  plan: PlanResponse | null;
  planLoading: boolean;
  planError: string | null;
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

export default function SidebarAnalysis({
  plan,
  planLoading,
  planError,
}: SidebarAnalysisProps) {
  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Analysis</h2>
        <p className="mt-1.5 text-sm text-zinc-500">
          Your weekly EV charging plan based on your locations.
        </p>
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
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
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
      )}

      {plan && !planError &&
        Object.keys(plan.daily_remaining_kwh ?? {}).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Battery remaining by day
            </h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {ALL_DAYS.map((day) => (
                <li key={day} className="flex items-center justify-between">
                  <span className="text-zinc-500">{DAY_SHORT_LABELS[day]}</span>
                  <span className="font-medium text-zinc-900">
                    {(plan.daily_remaining_kwh[day] ?? 0).toFixed(1)} kWh
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {plan && !planError && plan.charging_stations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Charging sessions
          </h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {plan.charging_stations.map((station, index) => (
              <li
                key={chargingStationKey(station, index)}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-zinc-900">
                  <span className="font-medium">
                    {formatVisitDay(station.visit_day)}
                  </span>{" "}
                  <span className="text-zinc-500">
                    {station.charger_kilowatts}kW {station.charger_type}
                  </span>
                </span>
                <span className="text-right text-zinc-500">
                  {station.charged_kwh.toFixed(1)} kWh ·{" "}
                  {Math.round(station.charge_minutes)} min ·{" "}
                  {station.distance_to_location.toFixed(1)} km away
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
