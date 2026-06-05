declare global {
	interface Window {
		__googleMapsInit?: () => void;
	}
}

const GOOGLE_MAPS_API_KEY =
	process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
	"AIzaSyBqmrfFCZoa7_XK5V28w_yYYBTYUmivUiI";

let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
	if (typeof window === "undefined") {
		return Promise.reject(
			new Error("Google Maps can only be loaded in the browser"),
		);
	}

	if (window.google?.maps?.places) {
		return Promise.resolve(window.google);
	}

	if (loadPromise) {
		return loadPromise;
	}

	loadPromise = new Promise((resolve, reject) => {
		window.__googleMapsInit = () => {
			delete window.__googleMapsInit;
			resolve(window.google);
		};

		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&libraries=places&callback=__googleMapsInit`;
		script.async = true;
		script.onerror = () => {
			loadPromise = null;
			reject(new Error("Failed to load Google Maps"));
		};
		document.head.appendChild(script);
	});

	return loadPromise;
}
