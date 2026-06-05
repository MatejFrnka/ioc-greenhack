import { type SelectedPlace } from "@/components/PlacesSearchBar";
import SidebarAnalysis from "@/components/SidebarAnalysis";
import SidebarSetup from "@/components/SidebarSetup";
import { type MapPoint } from "@/lib/map-points";
import { type PlanResponse } from "@/lib/plan";

export type PlacementStage = "home" | "locations";
export type SidebarView = "setup" | "analysis";

interface SidebarProps {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  points: MapPoint[];
  plan: PlanResponse | null;
  planLoading: boolean;
  planError: string | null;
  onAnalyze: () => void;
  onPlaceSelect: (place: SelectedPlace) => void;
  onNavigate: (point: MapPoint) => void;
  onDelete: (id: string) => void;
  onHoverChargingStation: (key: string | null) => void;
}

export default function Sidebar({
  view,
  onViewChange,
  points,
  plan,
  planLoading,
  planError,
  onAnalyze,
  onPlaceSelect,
  onNavigate,
  onDelete,
  onHoverChargingStation,
}: SidebarProps) {
  const hasHome = points.some((point) => point.type === "home");

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col bg-white">
      <div className="shrink-0 px-8 py-6">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          <span className="text-primary">EV</span>ify
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "setup" ? (
          <SidebarSetup
            points={points}
            onPlaceSelect={onPlaceSelect}
            onNavigate={onNavigate}
            onDelete={onDelete}
          />
        ) : (
          <SidebarAnalysis
            plan={plan}
            planLoading={planLoading}
            planError={planError}
            onHoverChargingStation={onHoverChargingStation}
          />
        )}
      </div>

      <div className="shrink-0 px-8 py-6">
        {view === "setup" ? (
          <button
            type="button"
            disabled={!hasHome}
            onClick={() => {
              onAnalyze();
              onViewChange("analysis");
            }}
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-zinc-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onViewChange("setup")}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          >
            Back to setup
          </button>
        )}
      </div>
    </aside>
  );
}
