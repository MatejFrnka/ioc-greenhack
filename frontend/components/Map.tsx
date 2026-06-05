"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyle } from "@/lib/map-style";
import type { MapPoint, PointType } from "@/lib/map-points";
import { createPlacementDialogElement } from "@/components/PlacementDialog";

interface MapProps {
	center?: [number, number];
	zoom?: number;
}

const DEFAULT_CENTER: [number, number] = [14.4378, 50.0755];
const DEFAULT_ZOOM = 11;

function createMarkerElement(type: PointType): HTMLDivElement {
	const el = document.createElement("div");
	el.className =
		"flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-md";
	el.style.backgroundColor = type === "work" ? "#18181b" : "#71717a";
	el.textContent = type === "work" ? "W" : "H";
	el.title = type === "work" ? "Work" : "Home";
	return el;
}

export default function Map({
	center = DEFAULT_CENTER,
	zoom = DEFAULT_ZOOM,
}: MapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);
	const placementPopupRef = useRef<maplibregl.Popup | null>(null);
	const markersRef = useRef(
		new globalThis.Map<string, maplibregl.Marker>(),
	);
	const initialViewRef = useRef({ center, zoom });

	const [points, setPoints] = useState<MapPoint[]>([]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const { center: initialCenter, zoom: initialZoom } =
			initialViewRef.current;

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
			"top-right",
		);
		map.addControl(
			new maplibregl.AttributionControl({ compact: true }),
			"bottom-right",
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
				offset: 12,
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
			for (const marker of markersRef.current.values()) {
				marker.remove();
			}
			markersRef.current.clear();
			map.remove();
			mapRef.current = null;
		};
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
				element: createMarkerElement(point.type),
				anchor: "center",
			})
				.setLngLat([point.lng, point.lat])
				.addTo(map);

			markersRef.current.set(point.id, marker);
		}
	}, [points]);

	return <div ref={containerRef} className="h-full w-full" />;
}
