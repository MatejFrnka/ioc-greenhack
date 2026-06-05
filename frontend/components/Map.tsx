"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyle } from "@/lib/map-style";
import {
  POINT_TYPE_CONFIG,
  type MapPoint,
  type PointType,
} from "@/lib/map-points";
import {
  chargingStationKey,
  DEFAULT_TIME_SPENT_MINUTES,
  DEFAULT_VISITS,
  fetchPlan,
  formatVisitDay,
  pointsToPlanRequest,
  type ChargingStation,
  type PlanResponse,
} from "@/lib/plan";
import { createPlacementDialogElement } from "@/components/PlacementDialog";
import { createPointActionDialogElement } from "@/components/PointActionDialog";
import { type SelectedPlace } from "@/components/PlacesSearchBar";
import ScheduleDialog from "@/components/ScheduleDialog";
import Sidebar, { type PlacementStage } from "@/components/Sidebar";

interface ScheduleDraft {
  lng: number;
  lat: number;
  type: PointType;
}

interface MapProps {
  center?: [number, number];
  zoom?: number;
}

const DEFAULT_CENTER: [number, number] = [14.4378, 50.0755];
const DEFAULT_ZOOM = 11;

function createMarkerElement(
  type: PointType,
  onClick: (event: MouseEvent) => void
): HTMLDivElement {
  const { icon, label, color, foreground } = POINT_TYPE_CONFIG[type];
  const el = document.createElement("div");
  el.className =
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md";
  el.style.backgroundColor = color;
  el.style.color = foreground;
  el.title = label;
  el.addEventListener("click", onClick);

  const iconEl = document.createElement("span");
  iconEl.className = "material-icons text-[15px] leading-none";
  iconEl.textContent = icon;
  el.append(iconEl);

  return el;
}

function createChargingMarkerElement(station: ChargingStation): HTMLDivElement {
  const isDc = station.charger_type === "DC";
  const el = document.createElement("div");
  el.className =
    "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md";
  el.style.backgroundColor = isDc ? "#16a34a" : "#ca8a04";
  el.style.color = "#ffffff";
  el.title = `${station.charger_kilowatts}kW ${
    station.charger_type
  } · ${formatVisitDay(
    station.visit_day
  )} · ${station.distance_to_location.toFixed(1)} km`;

  const iconEl = document.createElement("span");
  iconEl.className = "material-icons text-[16px] leading-none";
  iconEl.textContent = "ev_station";
  el.append(iconEl);

  return el;
}

export default function Map({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const placementPopupRef = useRef<maplibregl.Popup | null>(null);
  const pointActionPopupRef = useRef<maplibregl.Popup | null>(null);
  const openPointActionPopupRef = useRef<(point: MapPoint) => void>(() => {});
  const openPlacementPopupRef = useRef<(lng: number, lat: number) => void>(
    () => {}
  );
  const placementStageRef = useRef<PlacementStage>("home");
  const addHomePointRef = useRef<(lng: number, lat: number) => void>(() => {});
  const markersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const chargingMarkersRef = useRef(
    new globalThis.Map<string, maplibregl.Marker>()
  );
  const initialViewRef = useRef({ center, zoom });

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [placementStage, setPlacementStage] = useState<PlacementStage>("home");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(
    null
  );
  const [scheduleScreenPos, setScheduleScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const openScheduleRef = useRef<(draft: ScheduleDraft) => void>(() => {});
  const planAbortRef = useRef<AbortController | null>(null);

  const chargingStations = plan?.charging_stations ?? [];

  placementStageRef.current = placementStage;

  const addHomePoint = useCallback((lng: number, lat: number) => {
    setPoints((current) => {
      const withoutHome = current.filter((point) => point.type !== "home");
      return [
        ...withoutHome,
        {
          id: crypto.randomUUID(),
          lng,
          lat,
          type: "home",
          visits: DEFAULT_VISITS.home,
          timeSpentMinutes: DEFAULT_TIME_SPENT_MINUTES.home,
        },
      ];
    });
  }, []);

  addHomePointRef.current = addHomePoint;

  const addLocationPoint = useCallback(
    (
      lng: number,
      lat: number,
      type: PointType,
      visits: MapPoint["visits"],
      timeSpentMinutes: number
    ) => {
      setPoints((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          lng,
          lat,
          type,
          visits,
          timeSpentMinutes,
        },
      ]);
    },
    []
  );

  useEffect(() => {
    const hasHome = points.some((point) => point.type === "home");
    setPlacementStage(hasHome ? "locations" : "home");
  }, [points]);

  openScheduleRef.current = (draft) => {
    setScheduleDraft(draft);
  };

  const updateScheduleScreenPos = useCallback(() => {
    if (!scheduleDraft || !mapRef.current) return;
    const point = mapRef.current.project([
      scheduleDraft.lng,
      scheduleDraft.lat,
    ]);
    setScheduleScreenPos({ x: point.x, y: point.y });
  }, [scheduleDraft]);

  useEffect(() => {
    if (!scheduleDraft) {
      setScheduleScreenPos(null);
      return;
    }

    updateScheduleScreenPos();

    const map = mapRef.current;
    if (!map) return;

    map.on("move", updateScheduleScreenPos);
    map.on("zoom", updateScheduleScreenPos);

    return () => {
      map.off("move", updateScheduleScreenPos);
      map.off("zoom", updateScheduleScreenPos);
    };
  }, [scheduleDraft, updateScheduleScreenPos]);

  const removePoint = useCallback((id: string) => {
    setPoints((current) => current.filter((point) => point.id !== id));
    pointActionPopupRef.current?.remove();
    pointActionPopupRef.current = null;
  }, []);

  const navigateToPoint = useCallback((point: MapPoint) => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [point.lng, point.lat],
      zoom: 15,
      essential: true,
    });
  }, []);

  const handlePlaceSelect = useCallback(
    (place: SelectedPlace) => {
      const map = mapRef.current;
      if (!map) return;

      map.flyTo({
        center: [place.lng, place.lat],
        zoom: 15,
        essential: true,
      });

      if (placementStageRef.current === "home") {
        addHomePoint(place.lng, place.lat);
      } else {
        openPlacementPopupRef.current(place.lng, place.lat);
      }
    },
    [addHomePoint]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { center: initialCenter, zoom: initialZoom } = initialViewRef.current;

    const map = new maplibregl.Map({
      container,
      style: getMapStyle(),
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    });

    map.touchPitch.disable();
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    const closePlacementPopup = () => {
      placementPopupRef.current?.remove();
      placementPopupRef.current = null;
    };

    const closePointActionPopup = () => {
      pointActionPopupRef.current?.remove();
      pointActionPopupRef.current = null;
    };

    const openPointActionPopup = (point: MapPoint) => {
      closePlacementPopup();
      closePointActionPopup();

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: "bottom",
        offset: 12,
        className: "placement-popup",
      });

      const content = createPointActionDialogElement({
        onDelete: () => {
          removePoint(point.id);
          closePointActionPopup();
        },
        onCancel: closePointActionPopup,
      });

      popup.setDOMContent(content).setLngLat([point.lng, point.lat]).addTo(map);
      pointActionPopupRef.current = popup;
    };

    openPointActionPopupRef.current = openPointActionPopup;

    const openPlacementPopup = (lng: number, lat: number) => {
      closePlacementPopup();
      closePointActionPopup();

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: "bottom",
        offset: 0,
        className: "placement-popup",
      });

      const content = createPlacementDialogElement({
        onSelect: (type) => {
          closePlacementPopup();
          openScheduleRef.current({ lng, lat, type });
        },
        onCancel: closePlacementPopup,
      });

      popup.setDOMContent(content).setLngLat([lng, lat]).addTo(map);
      placementPopupRef.current = popup;
    };

    openPlacementPopupRef.current = openPlacementPopup;

    map.on("click", (event) => {
      setScheduleDraft(null);
      if (placementStageRef.current === "home") {
        addHomePointRef.current(event.lngLat.lng, event.lngLat.lat);
      } else {
        openPlacementPopup(event.lngLat.lng, event.lngLat.lat);
      }
    });

    mapRef.current = map;

    return () => {
      closePlacementPopup();
      closePointActionPopup();
      openPointActionPopupRef.current = () => {};
      openPlacementPopupRef.current = () => {};
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
      for (const marker of chargingMarkersRef.current.values()) {
        marker.remove();
      }
      chargingMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [removePoint]);

  const analyzePlan = useCallback(() => {
    planAbortRef.current?.abort();

    const request = pointsToPlanRequest(points);
    if (!request) {
      setPlan(null);
      setPlanError(null);
      setPlanLoading(false);
      return;
    }

    const controller = new AbortController();
    planAbortRef.current = controller;
    setPlanLoading(true);
    setPlanError(null);

    fetchPlan(request, controller.signal)
      .then((response) => {
        setPlan(response);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPlan(null);
        setPlanError(
          error instanceof Error ? error.message : "Failed to load plan"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPlanLoading(false);
        }
      });
  }, [points]);

  useEffect(() => {
    planAbortRef.current?.abort();
    setPlan(null);
    setPlanError(null);
    setPlanLoading(false);
  }, [points]);

  useEffect(() => {
    return () => planAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(points.map((point) => point.id));

    for (const [id, marker] of markersRef.current.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const point of points) {
      const existing = markersRef.current.get(point.id);
      if (existing) {
        existing.setLngLat([point.lng, point.lat]);
        continue;
      }

      const marker = new maplibregl.Marker({
        element: createMarkerElement(point.type, (event) => {
          event.stopPropagation();
          openPointActionPopupRef.current(point);
        }),
        anchor: "center",
      })
        .setLngLat([point.lng, point.lat])
        .addTo(map);

      markersRef.current.set(point.id, marker);
    }
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(
      chargingStations.map((station, index) =>
        chargingStationKey(station, index)
      )
    );

    for (const [id, marker] of chargingMarkersRef.current.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        chargingMarkersRef.current.delete(id);
      }
    }

    chargingStations.forEach((station, index) => {
      const id = chargingStationKey(station, index);
      const existing = chargingMarkersRef.current.get(id);
      if (existing) {
        existing.setLngLat([station.long, station.lat]);
        return;
      }

      const marker = new maplibregl.Marker({
        element: createChargingMarkerElement(station),
        anchor: "center",
      })
        .setLngLat([station.long, station.lat])
        .addTo(map);

      chargingMarkersRef.current.set(id, marker);
    });
  }, [chargingStations]);

  return (
    <div className="flex h-full w-full bg-zinc-100">
      <Sidebar
        points={points}
        plan={plan}
        planLoading={planLoading}
        planError={planError}
        onAnalyze={analyzePlan}
        onPlaceSelect={handlePlaceSelect}
        onNavigate={navigateToPoint}
        onDelete={removePoint}
      />
      <div
        className="relative min-w-0 flex-1 p-5"
        style={{ backgroundColor: "white" }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[100px] shadow-md ring-1 ring-zinc-200/80">
          <div ref={containerRef} className="h-full w-full" />

          {scheduleDraft && scheduleScreenPos && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: scheduleScreenPos.x,
                top: scheduleScreenPos.y,
                transform: "translate(-50%, calc(-100% - 12px))",
              }}
            >
              <ScheduleDialog
                type={scheduleDraft.type}
                onConfirm={(visits, hours) => {
                  addLocationPoint(
                    scheduleDraft.lng,
                    scheduleDraft.lat,
                    scheduleDraft.type,
                    visits,
                    Math.round(hours * 60)
                  );
                  setScheduleDraft(null);
                }}
                onCancel={() => setScheduleDraft(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
