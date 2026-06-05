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
  fetchPlan,
  formatVisitDay,
  pointsToPlanRequest,
  type ChargingStation,
} from "@/lib/plan";
import { createPlacementDialogElement } from "@/components/PlacementDialog";
import PlacesSearchBar, {
  type SelectedPlace,
} from "@/components/PlacesSearchBar";

interface MapProps {
  center?: [number, number];
  zoom?: number;
}

const DEFAULT_CENTER: [number, number] = [14.4378, 50.0755];
const DEFAULT_ZOOM = 11;

function createMarkerElement(type: PointType): HTMLDivElement {
  const { icon, label, color, foreground } = POINT_TYPE_CONFIG[type];
  const el = document.createElement("div");
  el.className =
    "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md";
  el.style.backgroundColor = color;
  el.style.color = foreground;
  el.title = label;

  const iconEl = document.createElement("span");
  iconEl.className = "material-icons text-[15px] leading-none";
  iconEl.textContent = icon;
  el.append(iconEl);

  return el;
}

function createSearchMarkerElement(name: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className =
    "h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-md";
  el.title = name;
  return el;
}

function createChargingMarkerElement(station: ChargingStation): HTMLDivElement {
  const isDc = station.charger_type === "DC";
  const el = document.createElement("div");
  el.className =
    "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md";
  el.style.backgroundColor = isDc ? "#16a34a" : "#ca8a04";
  el.style.color = "#ffffff";
  el.title = `${station.charger_kilowatts}kW ${station.charger_type} · ${formatVisitDay(station.visit_day)} · ${station.distance_to_location.toFixed(1)} km`;

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
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const chargingMarkersRef = useRef(
    new globalThis.Map<string, maplibregl.Marker>()
  );
  const initialViewRef = useRef({ center, zoom });

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>(
    []
  );
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const handlePlaceSelect = useCallback((place: SelectedPlace) => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [place.lng, place.lat],
      zoom: 15,
      essential: true,
    });

    searchMarkerRef.current?.remove();
    searchMarkerRef.current = new maplibregl.Marker({
      element: createSearchMarkerElement(place.name),
      anchor: "center",
    })
      .setLngLat([place.lng, place.lat])
      .addTo(map);
  }, []);

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
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    const closePlacementPopup = () => {
      placementPopupRef.current?.remove();
      placementPopupRef.current = null;
    };

    const addPoint = (lng: number, lat: number, type: PointType) => {
      setPoints((current) => {
        const withoutType = current.filter((point) => point.type !== type);
        return [
          ...withoutType,
          {
            id: crypto.randomUUID(),
            lng,
            lat,
            type,
          },
        ];
      });
    };

    const openPlacementPopup = (lngLat: maplibregl.LngLat) => {
      closePlacementPopup();

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: "bottom",
        offset: 0,
        className: "placement-popup",
      });

      const content = createPlacementDialogElement({
        onSelect: (type) => {
          addPoint(lngLat.lng, lngLat.lat, type);
          closePlacementPopup();
        },
        onCancel: closePlacementPopup,
      });

      popup.setDOMContent(content).setLngLat(lngLat).addTo(map);
      placementPopupRef.current = popup;
    };

    map.on("click", (event) => {
      openPlacementPopup(event.lngLat);
    });

    mapRef.current = map;

    return () => {
      closePlacementPopup();
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
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
  }, []);

  useEffect(() => {
    const request = pointsToPlanRequest(points);
    if (!request) {
      setChargingStations([]);
      setPlanError(null);
      setPlanLoading(false);
      return;
    }

    const controller = new AbortController();
    setPlanLoading(true);
    setPlanError(null);

    fetchPlan(request, controller.signal)
      .then((plan) => {
        setChargingStations(plan.charging_stations);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setChargingStations([]);
        setPlanError(
          error instanceof Error ? error.message : "Failed to load plan"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPlanLoading(false);
        }
      });

    return () => controller.abort();
  }, [points]);

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
        element: createMarkerElement(point.type),
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

  const showChargingPanel =
    planLoading || planError !== null || chargingStations.length > 0;

  return (
    <div className="relative h-full w-full">
      <PlacesSearchBar onPlaceSelect={handlePlaceSelect} />
      {showChargingPanel && (
        <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Charging stations
            </h2>
            {planLoading && (
              <span className="text-xs text-zinc-500">Loading…</span>
            )}
          </div>
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
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
