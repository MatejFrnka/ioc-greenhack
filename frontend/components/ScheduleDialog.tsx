"use client";

import { useState } from "react";
import {
  POINT_TYPE_CONFIG,
  type DayOfWeek,
  type PointType,
} from "@/lib/map-points";
import {
  ALL_DAYS,
  DAY_SHORT_LABELS,
  DEFAULT_VISITS,
  defaultHoursForType,
} from "@/lib/plan";

interface ScheduleDialogProps {
  type: PointType;
  onConfirm: (visits: DayOfWeek[], hours: number) => void;
  onCancel: () => void;
}

const MIN_HOURS = 0.5;
const MAX_HOURS = 16;
const HOURS_STEP = 0.5;

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

export default function ScheduleDialog({
  type,
  onConfirm,
  onCancel,
}: ScheduleDialogProps) {
  const { icon, label, color, foreground } = POINT_TYPE_CONFIG[type];
  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(
    () => new Set(DEFAULT_VISITS[type])
  );
  const [hours, setHours] = useState(defaultHoursForType(type));

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  return (
    <div className="pointer-events-auto flex w-72 flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: color, color: foreground }}
        >
          <span className="material-icons text-base leading-none">{icon}</span>
        </span>
        <span className="text-sm font-semibold text-zinc-900">{label}</span>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Visit days
        </p>
        <div className="grid grid-cols-7 gap-1">
          {ALL_DAYS.map((day) => {
            const active = selectedDays.has(day);
            return (
              <button
                key={day}
                type="button"
                title={DAY_SHORT_LABELS[day]}
                aria-pressed={active}
                onClick={() => toggleDay(day)}
                className={`rounded-lg px-0 py-1.5 text-[10px] font-semibold transition ${
                  active
                    ? "bg-[#297373] text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {DAY_SHORT_LABELS[day]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Hours per visit
        </p>
        <div className="flex items-center gap-2.5">
          <input
            type="range"
            min={MIN_HOURS}
            max={MAX_HOURS}
            step={HOURS_STEP}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#297373]"
          />
          <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-zinc-900">
            {formatHours(hours)} h
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <button
          type="button"
          title="Cancel"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:scale-105 hover:bg-zinc-200"
        >
          <span className="material-icons text-lg leading-none">close</span>
        </button>
        <button
          type="button"
          title="Add place"
          onClick={() => onConfirm([...selectedDays], hours)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#297373] text-white transition hover:scale-105 hover:bg-[#1f5757]"
        >
          <span className="material-icons text-lg leading-none">check</span>
        </button>
      </div>
    </div>
  );
}
