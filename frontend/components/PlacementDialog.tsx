import {
  FREQUENT_LOCATION_TYPES,
  POINT_TYPE_CONFIG,
  type PointType,
} from "@/lib/map-points";

interface PlacementDialogHandlers {
  onSelect: (type: PointType) => void;
  onCancel: () => void;
}

const ICON_SIZE = 48;
const ICON_HALF = ICON_SIZE / 2;
const CENTER_BTN_SIZE = 40;
const CENTER_BTN_HALF = CENTER_BTN_SIZE / 2;
const ARC_RADIUS = 65;
const ARC_SPAN = (115 * Math.PI) / 180;
const ARC_CENTER_ANGLE = Math.PI / 2;
const ARC_START = ARC_CENTER_ANGLE + ARC_SPAN / 2;
const CENTER_BTN_OFFSET = 22;
const ARC_OFFSET = 35;

const ARC_HALF_WIDTH = ARC_RADIUS * Math.sin(ARC_SPAN / 2);
const DIALOG_WIDTH = 2 * (ARC_HALF_WIDTH + ICON_HALF);
const CENTER_X = DIALOG_WIDTH / 2;
const CENTER_Y = ARC_RADIUS + ICON_HALF;
const DIALOG_HEIGHT = CENTER_Y + CENTER_BTN_HALF;

function createMaterialIcon(name: string): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "material-icons placement-dialog__icon-glyph";
  icon.textContent = name;
  return icon;
}

function createIconButton(
  type: PointType,
  x: number,
  y: number,
  onSelect: (type: PointType) => void
): HTMLButtonElement {
  const { icon, label, color, foreground } = POINT_TYPE_CONFIG[type];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "placement-dialog__icon-btn";
  button.title = label;
  button.style.left = `${x}px`;
  button.style.top = `${y}px`;
  button.style.backgroundColor = color;
  button.style.color = foreground;
  button.append(createMaterialIcon(icon));
  button.addEventListener("click", () => onSelect(type));
  return button;
}

export function createPlacementDialogElement({
  onSelect,
  onCancel,
}: PlacementDialogHandlers): HTMLElement {
  const root = document.createElement("div");
  root.className = "placement-dialog";
  root.style.width = `${DIALOG_WIDTH}px`;
  root.style.height = `${DIALOG_HEIGHT}px`;

  const arc = document.createElement("div");
  arc.className = "placement-dialog__arc";

  const count = FREQUENT_LOCATION_TYPES.length;
  for (let i = 0; i < count; i++) {
    const type = FREQUENT_LOCATION_TYPES[i];
    const angle = ARC_START - (i * ARC_SPAN) / (count - 1);
    const x = CENTER_X + ARC_RADIUS * Math.cos(angle);
    const y = CENTER_Y - ARC_RADIUS * Math.sin(angle) + ARC_OFFSET;
    arc.append(createIconButton(type, x, y, onSelect));
  }

  const centerButton = document.createElement("button");
  centerButton.type = "button";
  centerButton.className = "placement-dialog__center-btn";
  centerButton.title = "Cancel";
  centerButton.style.left = `${CENTER_X}px`;
  centerButton.style.top = `${CENTER_Y + CENTER_BTN_OFFSET}px`;
  centerButton.append(createMaterialIcon("close"));
  centerButton.addEventListener("click", onCancel);

  root.append(arc, centerButton);

  return root;
}
