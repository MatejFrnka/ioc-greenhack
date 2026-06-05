"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

export interface SelectedPlace {
  lng: number;
  lat: number;
  name: string;
}

interface PlacesSearchBarProps {
  onPlaceSelect: (place: SelectedPlace) => void;
}

export default function PlacesSearchBar({
  onPlaceSelect,
}: PlacesSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;

        autocomplete = new google.maps.places.Autocomplete(input, {
          fields: ["geometry", "name", "formatted_address"],
          componentRestrictions: { country: "cz" },
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          const location = place?.geometry?.location;
          if (!location) return;

          onPlaceSelectRef.current({
            lng: location.lng(),
            lat: location.lat(),
            name:
              place?.name ?? place?.formatted_address ?? "Selected location",
          });
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to initialize Places Autocomplete:", error);
      });

    return () => {
      cancelled = true;
      listener?.remove();
      if (window.google?.maps?.event) {
        google.maps.event.clearInstanceListeners(input);
      }
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4">
      <div className="pointer-events-auto relative mx-auto w-full max-w-xl">
        <span
          className="material-icons pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl text-zinc-400"
          aria-hidden="true"
        >
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for a location..."
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pr-4 pl-11 text-sm text-zinc-900 shadow-lg outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
        />
      </div>
    </div>
  );
}
