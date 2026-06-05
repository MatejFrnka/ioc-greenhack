const CARTO_POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const MAPTILER_TONER = "https://api.maptiler.com/maps/toner/style.json";

export function getMapStyle(): string {
	const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
	if (key) {
		return `${MAPTILER_TONER}?key=${key}`;
	}
	return CARTO_POSITRON;
}
