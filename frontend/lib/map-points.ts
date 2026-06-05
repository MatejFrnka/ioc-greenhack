export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type PointType =
  | "home"
  | "work"
  | "school"
  | "shopping_cart"
  | "question_mark";

export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  type: PointType;
  visits: DayOfWeek[];
  timeSpentMinutes: number;
}

const ALPHA = 0.9;

export const PALETTE = {
  gold: `rgba(233, 215, 88, ${ALPHA})`,
  teal: `rgba(41, 115, 115, ${ALPHA})`,
  coral: `rgba(255, 133, 82, ${ALPHA})`,
  charcoal: `rgba(62, 54, 63, ${ALPHA})`,
  berry: `rgba(161, 74, 118, ${ALPHA})`,
} as const;

export const POINT_TYPE_CONFIG: Record<
  PointType,
  { icon: string; label: string; color: string; foreground: string }
> = {
  home: {
    icon: "home",
    label: "Home",
    color: "#2347d9ab",
    foreground: "#ffffff",
  },
  work: {
    icon: "work",
    label: "Work",
    color: PALETTE.teal,
    foreground: "#ffffff",
  },
  school: {
    icon: "school",
    label: "School",
    color: PALETTE.coral,
    foreground: "#3e363f",
  },
  shopping_cart: {
    icon: "shopping_cart",
    label: "Shopping",
    color: PALETTE.charcoal,
    foreground: "#ffffff",
  },
  question_mark: {
    icon: "question_mark",
    label: "Other",
    color: PALETTE.berry,
    foreground: "#ffffff",
  },
};

export const PLACEMENT_POINT_TYPES = Object.keys(
  POINT_TYPE_CONFIG
) as PointType[];

export const FREQUENT_LOCATION_TYPES = PLACEMENT_POINT_TYPES.filter(
  (type) => type !== "home"
);
