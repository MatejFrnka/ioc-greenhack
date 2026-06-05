import { formatWeeklyCzk, totalWeeklyKm, type PlanResponse } from "@/lib/plan";

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
    </div>
  );
}
