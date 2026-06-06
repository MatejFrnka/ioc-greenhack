"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyle } from "@/lib/map-style";
import {
  POINT_TYPE_CONFIG,
  type DayOfWeek,
  type MapPoint,
  type PointType,
} from "@/lib/map-points";
import {
  CHARGING_STATION_AC_COLOR,
  chargingStationKey,
  dedupeStationsInRange,
  DEFAULT_BATTERY_KWH,
  DEFAULT_TIME_SPENT_MINUTES,
  DEFAULT_VISITS,
  fetchPlan,
  fetchStations,
  formatStationInRangeDistance,
  formatVisitDay,
  planForBatteryCapacity,
  pointsToPlanRequest,
  stationInRangeKey,
  type ChargingStation,
  type PathFromHome,
  type PlanResponseByCapacity,
  type StationCoordinate,
  type StationInRange,
} from "@/lib/plan";
import { createPlacementDialogElement } from "@/components/PlacementDialog";
import { createScheduleDialogElement } from "@/components/ScheduleDialog";
import { type SelectedPlace } from "@/components/PlacesSearchBar";
import Sidebar, {
  type PlacementStage,
  type SidebarView,
} from "@/components/Sidebar";

interface MapProps {
  center?: [number, number];
  zoom?: number;
}

const DEFAULT_CENTER: [number, number] = [14.4378, 50.0755];
const DEFAULT_ZOOM = 11;
const ALL_STATIONS_SOURCE_ID = "all-stations";
const ALL_STATIONS_LAYER_ID = "all-stations-dots";
const PATHS_SOURCE_ID = "paths-from-home";
const PATHS_LAYER_ID = "paths-from-home-lines";
const STATION_PATHS_SOURCE_ID = "paths-from-stations";
const STATION_PATHS_LAYER_ID = "paths-from-stations-lines";
const STATION_PATHS_COLOR = "#64748b";
const PRIMARY_COLOR = "#95e06c";
const PATHS_LINE_WIDTH: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8,
  2,
  11,
  3,
  14,
  4,
  17,
  6,
];
const ALL_STATIONS_CIRCLE_RADIUS: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8,
  1,
  11,
  2,
  14,
  5,
  17,
  10,
];
function stationsToGeoJSON(
  stations: StationCoordinate[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.map(([lat, lng]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {},
    })),
  };
}

function pathsToGeoJSON(
  paths: PathFromHome[],
  locationPoints: MapPoint[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: paths.flatMap((path, index) => {
      if (path.path.length < 2) return [];

      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: path.path.map((point) => [point.lng, point.lat]),
          },
          properties: {
            distance: path.distance,
            color:
              POINT_TYPE_CONFIG[locationPoints[index]?.type ?? "question_mark"]
                .color,
          },
        },
      ];
    }),
  };
}

function removePathsLayer(map: maplibregl.Map) {
  if (map.getLayer(PATHS_LAYER_ID)) {
    map.removeLayer(PATHS_LAYER_ID);
  }
  if (map.getSource(PATHS_SOURCE_ID)) {
    map.removeSource(PATHS_SOURCE_ID);
  }
}

function stationPathsToGeoJSON(
  paths: PathFromHome[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: paths.flatMap((path) => {
      if (path.path.length < 2) return [];

      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: path.path.map((point) => [point.lng, point.lat]),
          },
          properties: { distance: path.distance },
        },
      ];
    }),
  };
}

function removeStationPathsLayer(map: maplibregl.Map) {
  if (map.getLayer(STATION_PATHS_LAYER_ID)) {
    map.removeLayer(STATION_PATHS_LAYER_ID);
  }
  if (map.getSource(STATION_PATHS_SOURCE_ID)) {
    map.removeSource(STATION_PATHS_SOURCE_ID);
  }
}

function removeAllPathLayers(map: maplibregl.Map) {
  removePathsLayer(map);
  removeStationPathsLayer(map);
}

function updatePathsFromStationsLayer(
  map: maplibregl.Map,
  paths: PathFromHome[]
) {
  if (paths.length === 0) {
    removeStationPathsLayer(map);
    return;
  }

  const data = stationPathsToGeoJSON(paths);
  const existing = map.getSource(STATION_PATHS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (existing) {
    existing.setData(data);
    if (!map.getLayer(STATION_PATHS_LAYER_ID)) {
      map.addLayer({
        id: STATION_PATHS_LAYER_ID,
        type: "line",
        source: STATION_PATHS_SOURCE_ID,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": STATION_PATHS_COLOR,
          "line-width": PATHS_LINE_WIDTH,
          "line-opacity": 0.9,
          "line-dasharray": [2, 2],
        },
      });
    }
    return;
  }

  map.addSource(STATION_PATHS_SOURCE_ID, { type: "geojson", data });
  map.addLayer({
    id: STATION_PATHS_LAYER_ID,
    type: "line",
    source: STATION_PATHS_SOURCE_ID,
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": STATION_PATHS_COLOR,
      "line-width": PATHS_LINE_WIDTH,
      "line-opacity": 0.9,
      "line-dasharray": [2, 2],
    },
  });
}

function updatePathsFromHomeLayer(
  map: maplibregl.Map,
  paths: PathFromHome[],
  locationPoints: MapPoint[]
) {
  if (paths.length === 0) {
    removePathsLayer(map);
    return;
  }

  const data = pathsToGeoJSON(paths, locationPoints);
  const existing = map.getSource(PATHS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (existing) {
    existing.setData(data);
    if (!map.getLayer(PATHS_LAYER_ID)) {
      map.addLayer({
        id: PATHS_LAYER_ID,
        type: "line",
        source: PATHS_SOURCE_ID,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": PATHS_LINE_WIDTH,
          "line-opacity": 0.85,
        },
      });
    }
    return;
  }

  map.addSource(PATHS_SOURCE_ID, { type: "geojson", data });
  map.addLayer({
    id: PATHS_LAYER_ID,
    type: "line",
    source: PATHS_SOURCE_ID,
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": ["get", "color"],
      "line-width": PATHS_LINE_WIDTH,
      "line-opacity": 0.85,
    },
  });
}

function syncPathLayers(
  map: maplibregl.Map,
  pathsFromHome: PathFromHome[],
  pathsFromStations: PathFromHome[],
  locationPoints: MapPoint[]
) {
  updatePathsFromHomeLayer(map, pathsFromHome, locationPoints);
  updatePathsFromStationsLayer(map, pathsFromStations);
}

function isSameStationLocation(
  a: { lat: number; long: number },
  b: { lat: number; long: number }
): boolean {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.long - b.long) < 1e-5;
}

function filterStationsInRange(
  inRange: StationInRange[],
  selected: ChargingStation[]
): StationInRange[] {
  return dedupeStationsInRange(inRange).filter(
    (station) =>
      !selected.some((chosen) => isSameStationLocation(station, chosen))
  );
}

function stationInRangeHoverHtml(station: StationInRange): string {
  return `<div class="station-hover-tooltip">
    <div class="station-hover-tooltip__title">${station.charger_kilowatts} kW ${station.charger_type}</div>
    <div class="station-hover-tooltip__meta">${formatStationInRangeDistance(station.distance_to_location)} away</div>
  </div>`;
}

function selectedChargingStationHoverHtml(station: ChargingStation): string {
  return `<div class="station-hover-tooltip">
    <div class="station-hover-tooltip__title">${station.charger_kilowatts} kW ${station.charger_type}</div>
    <div class="station-hover-tooltip__meta">${formatVisitDay(station.visit_day)} · ${station.charged_kwh.toFixed(1)} kWh · ${station.distance_to_location.toFixed(1)} km away</div>
  </div>`;
}

function attachMarkerHoverPopup(
  map: maplibregl.Map,
  element: HTMLElement,
  lngLat: [number, number],
  html: string
) {
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "station-hover-popup",
    offset: 12,
  });

  element.addEventListener("mouseenter", () => {
    popup.setLngLat(lngLat).setHTML(html).addTo(map);
  });
  element.addEventListener("mouseleave", () => popup.remove());
}

function clearStationsInRangeMarkers(
  markers: globalThis.Map<string, maplibregl.Marker>
) {
  for (const marker of markers.values()) {
    marker.remove();
  }
  markers.clear();
}

function syncStationsInRangeMarkers(
  map: maplibregl.Map,
  markers: globalThis.Map<string, maplibregl.Marker>,
  stations: StationInRange[],
  selectedStations: ChargingStation[]
) {
  const visible = filterStationsInRange(stations, selectedStations);
  const activeIds = new Set(
    visible.map((station, index) => stationInRangeKey(station, index))
  );

  for (const [id, marker] of markers.entries()) {
    if (!activeIds.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  }

  visible.forEach((station, index) => {
    const id = stationInRangeKey(station, index);
    const lngLat: [number, number] = [station.long, station.lat];
    const existing = markers.get(id);
    if (existing) {
      existing.setLngLat(lngLat);
      return;
    }

    const element = createChargingMarkerElement({
      color: CHARGING_STATION_AC_COLOR,
      foreground: "#ffffff",
      title: `${station.charger_kilowatts} kW ${station.charger_type} · ${formatStationInRangeDistance(station.distance_to_location)} away`,
    });
    attachMarkerHoverPopup(map, element, lngLat, stationInRangeHoverHtml(station));

    const marker = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat(lngLat)
      .addTo(map);
    markers.set(id, marker);
  });
}

function updateAllStationsLayer(
  map: maplibregl.Map,
  stations: StationCoordinate[]
) {
  const data = stationsToGeoJSON(stations);
  const existing = map.getSource(ALL_STATIONS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (existing) {
    existing.setData(data);
    if (map.getLayer(ALL_STATIONS_LAYER_ID)) {
      map.setPaintProperty(
        ALL_STATIONS_LAYER_ID,
        "circle-color",
        PRIMARY_COLOR
      );
      map.setPaintProperty(ALL_STATIONS_LAYER_ID, "circle-opacity", 1);
    }
    return;
  }

  map.addSource(ALL_STATIONS_SOURCE_ID, { type: "geojson", data });
  map.addLayer({
    id: ALL_STATIONS_LAYER_ID,
    type: "circle",
    source: ALL_STATIONS_SOURCE_ID,
    paint: {
      "circle-radius": ALL_STATIONS_CIRCLE_RADIUS,
      "circle-color": PRIMARY_COLOR,
      "circle-opacity": 1,
    },
  });
}

function createMarkerElement(
  type: PointType,
  onClick: (event: MouseEvent) => void
): HTMLDivElement {
  const { icon, label, color, foreground } = POINT_TYPE_CONFIG[type];
  const el = document.createElement("div");
  el.className =
    "flex cursor-pointer items-center justify-center rounded-full border-2 border-white p-2.5 shadow-md";
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

function createChargingMarkerElement(options: {
  color: string;
  foreground?: string;
  title: string;
}): HTMLDivElement {
  const foreground = options.foreground ?? "#ffffff";
  const el = document.createElement("div");
  el.className = "charging-marker";
  el.title = options.title;

  const badge = document.createElement("div");
  badge.className =
    "charging-marker__badge flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md";
  badge.style.backgroundColor = options.color;
  badge.style.color = foreground;

  const iconEl = document.createElement("span");
  iconEl.className = "material-icons text-[16px] leading-none";
  iconEl.textContent = "ev_station";
  badge.append(iconEl);
  el.append(badge);

  return el;
}

export default function Map({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const placementPopupRef = useRef<maplibregl.Popup | null>(null);
  const schedulePopupRef = useRef<maplibregl.Popup | null>(null);
  const openSchedulePopupRef = useRef<
    (pointOrId: MapPoint | string, options?: { isNew?: boolean }) => void
  >(() => {});
  const pointsRef = useRef<MapPoint[]>([]);
  const openPlacementPopupRef = useRef<(lng: number, lat: number) => void>(
    () => {}
  );
  const placementStageRef = useRef<PlacementStage>("home");
  const sidebarViewRef = useRef<SidebarView>("setup");
  const addHomePointRef = useRef<(lng: number, lat: number) => void>(() => {});
  const markersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const chargingMarkersRef = useRef(
    new globalThis.Map<string, maplibregl.Marker>()
  );
  const stationsInRangeMarkersRef = useRef(
    new globalThis.Map<string, maplibregl.Marker>()
  );
  const allStationsRef = useRef<StationCoordinate[]>([]);
  const stationsAbortRef = useRef<AbortController | null>(null);
  const initialViewRef = useRef({ center, zoom });

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>("setup");
  const [placementStage, setPlacementStage] = useState<PlacementStage>("home");
  const [allStations, setAllStations] = useState<StationCoordinate[]>([]);
  const [plans, setPlans] = useState<PlanResponseByCapacity | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);
  const addPointWithDefaultsRef = useRef<
    (lng: number, lat: number, type: PointType) => MapPoint
  >(() => ({} as MapPoint));
  const updatePointRef = useRef<
    (id: string, visits: DayOfWeek[], timeSpentMinutes: number) => void
  >(() => {});
  const removePointRef = useRef<(id: string) => void>(() => {});
  const [highlightedChargingKey, setHighlightedChargingKey] = useState<
    string | null
  >(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [batteryCapacity, setBatteryCapacity] =
    useState<number>(DEFAULT_BATTERY_KWH);

  const plan =
    plans !== null ? planForBatteryCapacity(plans, batteryCapacity) : null;
  const chargingStations = plan?.charging_stations ?? [];
  const stationsInRange = plan?.stations_in_range ?? [];
  const pathsFromHome = plan?.paths_from_home ?? [];
  const pathsFromStations = plan?.paths_from_stations ?? [];
  pointsRef.current = points;

  // Hovering a charging session in the list highlights its marker; it lingers
  // briefly after the pointer leaves so the pulse is noticeable.
  const handleHoverChargingStation = useCallback((key: string | null) => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (key) {
      setHighlightedChargingKey(key);
    } else {
      highlightTimerRef.current = setTimeout(
        () => setHighlightedChargingKey(null),
        1200
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  placementStageRef.current = placementStage;
  sidebarViewRef.current = sidebarView;
  allStationsRef.current = allStations;

  useEffect(() => {
    stationsAbortRef.current?.abort();
    const controller = new AbortController();
    stationsAbortRef.current = controller;

    fetchStations(controller.signal)
      .then(setAllStations)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load charging stations:", error);
      });

    return () => controller.abort();
  }, []);

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

  const addPointWithDefaults = useCallback(
    (lng: number, lat: number, type: PointType): MapPoint => {
      const point: MapPoint = {
        id: crypto.randomUUID(),
        lng,
        lat,
        type,
        visits: DEFAULT_VISITS[type],
        timeSpentMinutes: DEFAULT_TIME_SPENT_MINUTES[type],
      };
      setPoints((current) => [...current, point]);
      return point;
    },
    []
  );

  const updatePoint = useCallback(
    (id: string, visits: DayOfWeek[], timeSpentMinutes: number) => {
      setPoints((current) =>
        current.map((point) =>
          point.id === id ? { ...point, visits, timeSpentMinutes } : point
        )
      );
    },
    []
  );

  addPointWithDefaultsRef.current = addPointWithDefaults;
  updatePointRef.current = updatePoint;

  useEffect(() => {
    const hasHome = points.some((point) => point.type === "home");
    setPlacementStage(hasHome ? "locations" : "home");
  }, [points]);

  const removePoint = useCallback((id: string) => {
    setPoints((current) => current.filter((point) => point.id !== id));
    schedulePopupRef.current?.remove();
    schedulePopupRef.current = null;
  }, []);

  removePointRef.current = removePoint;

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
      if (sidebarViewRef.current === "analysis") return;

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

    const closeSchedulePopup = () => {
      schedulePopupRef.current?.remove();
      schedulePopupRef.current = null;
    };

    const resolvePoint = (
      pointOrId: MapPoint | string
    ): MapPoint | undefined => {
      if (typeof pointOrId === "string") {
        return pointsRef.current.find(
          (candidate) => candidate.id === pointOrId
        );
      }
      return (
        pointsRef.current.find((candidate) => candidate.id === pointOrId.id) ??
        pointOrId
      );
    };

    const openSchedulePopup = (
      pointOrId: MapPoint | string,
      options?: { isNew?: boolean }
    ) => {
      const point = resolvePoint(pointOrId);
      if (!point) return;

      const pointId = point.id;
      closePlacementPopup();
      closeSchedulePopup();

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: "bottom",
        offset: 12,
        className: "placement-popup",
      });

      const content = createScheduleDialogElement({
        type: point.type,
        initialVisits: point.visits,
        initialHours: point.timeSpentMinutes / 60,
        onConfirm: (visits, hours) => {
          updatePointRef.current(pointId, visits, Math.round(hours * 60));
          closeSchedulePopup();
        },
        onCancel: () => {
          if (options?.isNew) {
            removePointRef.current(pointId);
          }
          closeSchedulePopup();
        },
        onDelete: () => {
          removePointRef.current(pointId);
          closeSchedulePopup();
        },
      });

      popup.setDOMContent(content).setLngLat([point.lng, point.lat]).addTo(map);
      schedulePopupRef.current = popup;
    };

    openSchedulePopupRef.current = openSchedulePopup;

    const openPlacementPopup = (lng: number, lat: number) => {
      closePlacementPopup();
      closeSchedulePopup();

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
          const point = addPointWithDefaultsRef.current(lng, lat, type);
          openSchedulePopup(point, { isNew: true });
        },
        onCancel: closePlacementPopup,
      });

      popup.setDOMContent(content).setLngLat([lng, lat]).addTo(map);
      placementPopupRef.current = popup;
    };

    openPlacementPopupRef.current = openPlacementPopup;

    map.on("click", (event) => {
      const target = event.originalEvent.target;
      if (
        target instanceof Element &&
        target.closest(".schedule-dialog, .placement-dialog, .maplibregl-popup")
      ) {
        return;
      }

      closeSchedulePopup();
      if (sidebarViewRef.current === "analysis") return;

      if (placementStageRef.current === "home") {
        addHomePointRef.current(event.lngLat.lng, event.lngLat.lat);
      } else {
        openPlacementPopup(event.lngLat.lng, event.lngLat.lat);
      }
    });

    mapRef.current = map;

    const syncAllStationsLayer = () => {
      if (allStationsRef.current.length === 0) return;
      updateAllStationsLayer(map, allStationsRef.current);
    };

    if (map.isStyleLoaded()) {
      syncAllStationsLayer();
    } else {
      map.once("load", syncAllStationsLayer);
    }

    return () => {
      closePlacementPopup();
      closeSchedulePopup();
      openSchedulePopupRef.current = () => {};
      openPlacementPopupRef.current = () => {};
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
      for (const marker of chargingMarkersRef.current.values()) {
        marker.remove();
      }
      chargingMarkersRef.current.clear();
      clearStationsInRangeMarkers(stationsInRangeMarkersRef.current);
      if (map.getLayer(ALL_STATIONS_LAYER_ID)) {
        map.removeLayer(ALL_STATIONS_LAYER_ID);
      }
      if (map.getSource(ALL_STATIONS_SOURCE_ID)) {
        map.removeSource(ALL_STATIONS_SOURCE_ID);
      }
      removeAllPathLayers(map);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || allStations.length === 0) return;

    const apply = () => updateAllStationsLayer(map, allStations);

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [allStations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const locationPoints = points.filter((point) => point.type !== "home");

    const apply = () => {
      if (sidebarView !== "analysis") {
        removeAllPathLayers(map);
        clearStationsInRangeMarkers(stationsInRangeMarkersRef.current);
        return;
      }
      syncPathLayers(map, pathsFromHome, pathsFromStations, locationPoints);
      syncStationsInRangeMarkers(
        map,
        stationsInRangeMarkersRef.current,
        stationsInRange,
        chargingStations
      );
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [
    pathsFromHome,
    pathsFromStations,
    stationsInRange,
    chargingStations,
    points,
    sidebarView,
  ]);

  const analyzePlan = useCallback(() => {
    planAbortRef.current?.abort();

    const request = pointsToPlanRequest(points);
    if (!request) {
      setPlans(null);
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
        setPlans(response);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPlans(null);
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
    setPlans(null);
    setPlanError(null);
    setPlanLoading(false);
  }, [points]);

  useEffect(() => {
    if (sidebarView !== "analysis") return;

    placementPopupRef.current?.remove();
    placementPopupRef.current = null;
    schedulePopupRef.current?.remove();
    schedulePopupRef.current = null;
  }, [sidebarView]);

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

      const pointId = point.id;
      const marker = new maplibregl.Marker({
        element: createMarkerElement(point.type, (event) => {
          event.stopPropagation();
          if (sidebarViewRef.current === "analysis") return;
          openSchedulePopupRef.current(pointId);
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
      const lngLat: [number, number] = [station.long, station.lat];
      const existing = chargingMarkersRef.current.get(id);
      if (existing) {
        existing.setLngLat(lngLat);
        return;
      }

      const element = createChargingMarkerElement({
        color: PRIMARY_COLOR,
        foreground: "#ffffff",
        title: `${station.charger_kilowatts}kW ${station.charger_type} · ${formatVisitDay(station.visit_day)} · ${station.distance_to_location.toFixed(1)} km`,
      });
      attachMarkerHoverPopup(
        map,
        element,
        lngLat,
        selectedChargingStationHoverHtml(station)
      );

      const marker = new maplibregl.Marker({
        element,
        anchor: "center",
      })
        .setLngLat(lngLat)
        .addTo(map);

      chargingMarkersRef.current.set(id, marker);
    });
  }, [chargingStations]);

  useEffect(() => {
    for (const [id, marker] of chargingMarkersRef.current.entries()) {
      const el = marker.getElement();
      const active = id === highlightedChargingKey;
      el.classList.toggle("charging-marker--active", active);
      el.style.zIndex = active ? "10" : "";
    }
  }, [highlightedChargingKey, chargingStations]);

  return (
    <div className="flex h-full w-full bg-zinc-100">
      <Sidebar
        view={sidebarView}
        onViewChange={setSidebarView}
        points={points}
        plan={plan}
        planLoading={planLoading}
        planError={planError}
        onAnalyze={analyzePlan}
        onPlaceSelect={handlePlaceSelect}
        onNavigate={navigateToPoint}
        onDelete={removePoint}
        onHoverChargingStation={handleHoverChargingStation}
        batteryCapacity={batteryCapacity}
        onBatteryCapacityChange={setBatteryCapacity}
      />
      <div
        className="relative min-w-0 flex-1 p-5"
        style={{ backgroundColor: "white" }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[100px] shadow-md ring-1 ring-zinc-200/80">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
