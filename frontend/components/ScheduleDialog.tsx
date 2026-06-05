import type { DayOfWeek, PointType } from "@/lib/map-points";
import {
  ALL_DAYS,
  DAY_SHORT_LABELS,
  defaultHoursForType,
} from "@/lib/plan";

interface ScheduleDialogHandlers {
  type: PointType;
  initialVisits: DayOfWeek[];
  initialHours?: number;
  onConfirm: (visits: DayOfWeek[], hours: number) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const MIN_HOURS = 0.5;
const MAX_HOURS = 16;
const HOURS_STEP = 0.5;

function createMaterialIcon(name: string): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "material-icons schedule-dialog__icon-glyph";
  icon.textContent = name;
  return icon;
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

export function createScheduleDialogElement({
  type,
  initialVisits,
  initialHours = defaultHoursForType(type),
  onConfirm,
  onCancel,
  onDelete,
}: ScheduleDialogHandlers): HTMLElement {
  const selectedDays = new Set<DayOfWeek>(initialVisits);
  let hours = initialHours;

  const root = document.createElement("div");
  root.className = "schedule-dialog";
  const stopMapClick = (event: Event) => {
    event.stopPropagation();
  };
  root.addEventListener("mousedown", stopMapClick);
  root.addEventListener("click", stopMapClick);

  const daysSection = document.createElement("div");
  daysSection.className = "schedule-dialog__section";

  const daysLabel = document.createElement("p");
  daysLabel.className = "schedule-dialog__label";
  daysLabel.textContent = "Visit days";

  const daysGrid = document.createElement("div");
  daysGrid.className = "schedule-dialog__days";

  const dayButtons = new Map<DayOfWeek, HTMLButtonElement>();

  const syncDayButton = (day: DayOfWeek) => {
    const button = dayButtons.get(day);
    if (!button) return;
    const active = selectedDays.has(day);
    button.classList.toggle("schedule-dialog__day-btn--active", active);
    button.setAttribute("aria-pressed", String(active));
  };

  for (const day of ALL_DAYS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "schedule-dialog__day-btn";
    button.title = DAY_SHORT_LABELS[day];
    button.textContent = DAY_SHORT_LABELS[day];
    button.addEventListener("click", () => {
      if (selectedDays.has(day)) {
        selectedDays.delete(day);
      } else {
        selectedDays.add(day);
      }
      syncDayButton(day);
    });
    dayButtons.set(day, button);
    syncDayButton(day);
    daysGrid.append(button);
  }

  daysSection.append(daysLabel, daysGrid);

  const hoursSection = document.createElement("div");
  hoursSection.className = "schedule-dialog__section";

  const hoursLabel = document.createElement("p");
  hoursLabel.className = "schedule-dialog__label";
  hoursLabel.textContent = "Hours per visit";

  const hoursRow = document.createElement("div");
  hoursRow.className = "schedule-dialog__hours-row";

  const hoursValue = document.createElement("span");
  hoursValue.className = "schedule-dialog__hours-value";

  const syncHoursValue = () => {
    hoursValue.textContent = `${formatHours(hours)} h`;
  };

  const hoursSlider = document.createElement("input");
  hoursSlider.type = "range";
  hoursSlider.className = "schedule-dialog__hours-slider";
  hoursSlider.min = String(MIN_HOURS);
  hoursSlider.max = String(MAX_HOURS);
  hoursSlider.step = String(HOURS_STEP);
  hoursSlider.value = String(hours);
  hoursSlider.addEventListener("input", () => {
    hours = Number(hoursSlider.value);
    syncHoursValue();
  });

  syncHoursValue();
  hoursRow.append(hoursSlider, hoursValue);
  hoursSection.append(hoursLabel, hoursRow);

  const actions = document.createElement("div");
  actions.className = "schedule-dialog__actions";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "schedule-dialog__delete-btn";
  deleteButton.title = "Delete";
  deleteButton.append(createMaterialIcon("delete"));
  deleteButton.addEventListener("click", onDelete);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "schedule-dialog__cancel-btn";
  cancelButton.title = "Cancel";
  cancelButton.append(createMaterialIcon("close"));
  cancelButton.addEventListener("click", onCancel);

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "schedule-dialog__confirm-btn";
  confirmButton.title = "Save";
  confirmButton.append(createMaterialIcon("check"));
  confirmButton.addEventListener("click", () => {
    onConfirm([...selectedDays], hours);
  });

  actions.append(deleteButton, cancelButton, confirmButton);
  root.append(daysSection, hoursSection, actions);

  return root;
}
