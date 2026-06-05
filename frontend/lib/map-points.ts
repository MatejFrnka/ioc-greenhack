export type PointType = "work" | "home";

export interface MapPoint {
	id: string;
	lng: number;
	lat: number;
	type: PointType;
}
