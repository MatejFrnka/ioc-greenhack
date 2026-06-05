import PlacesSearchBar, {
  type SelectedPlace,
} from "@/components/PlacesSearchBar";
import { POINT_TYPE_CONFIG, type MapPoint } from "@/lib/map-points";

interface SidebarSetupProps {
  points: MapPoint[];
  onPlaceSelect: (place: SelectedPlace) => void;
  onNavigate: (point: MapPoint) => void;
  onDelete: (id: string) => void;
}

function PlaceRow({
  point,
  onNavigate,
  onDelete,
}: {
  point: MapPoint;
  onNavigate: (point: MapPoint) => void;
  onDelete: (id: string) => void;
}) {
  const { icon, label, color, foreground } = POINT_TYPE_CONFIG[point.type];

  return (
    <div className="group flex items-center gap-1 rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onNavigate(point)}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: color, color: foreground }}
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
        className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <span className="material-icons text-[17px] leading-none">delete</span>
      </button>
    </div>
  );
}

export default function SidebarSetup({
  points,
  onPlaceSelect,
  onNavigate,
  onDelete,
}: SidebarSetupProps) {
  const homePoint = points.find((point) => point.type === "home");
  const otherPoints = points.filter((point) => point.type !== "home");

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Select home address
          </h2>
          <p className="mt-1.5 text-sm text-zinc-500">
            Search or click the map to set your home.
          </p>
        </div>

        {homePoint ? (
          <PlaceRow
            point={homePoint}
            onNavigate={onNavigate}
            onDelete={onDelete}
          />
        ) : (
          <PlacesSearchBar
            onPlaceSelect={onPlaceSelect}
            placeholder="Search for your home..."
          />
        )}
      </div>

      {homePoint && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Select your frequent locations
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Search or click the map to add a stop.
            </p>
          </div>

          <PlacesSearchBar
            onPlaceSelect={onPlaceSelect}
            placeholder="Search for a location..."
          />

          {otherPoints.length > 0 && (
            <ul className="space-y-2">
              {otherPoints.map((point) => (
                <li key={point.id}>
                  <PlaceRow
                    point={point}
                    onNavigate={onNavigate}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
