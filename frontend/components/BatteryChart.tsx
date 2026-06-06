"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DAY_SHORT_LABELS, type SocPoint } from "@/lib/plan";

const chartConfig = {
  kwh: {
    label: "Battery",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

interface BatteryChartProps {
  trajectory: SocPoint[];
}

export default function BatteryChart({ trajectory }: BatteryChartProps) {
  // One X tick per day, placed at the first point that falls on that day.
  const dayTicks: number[] = [];
  const seenDays = new Set<string>();
  for (const point of trajectory) {
    if (!seenDays.has(point.day)) {
      seenDays.add(point.day);
      dayTicks.push(point.index);
    }
  }
  const dayByIndex = new Map(trajectory.map((p) => [p.index, p.day]));

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <LineChart data={trajectory} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="index"
          type="number"
          domain={["dataMin", "dataMax"]}
          ticks={dayTicks}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(index: number) => {
            const day = dayByIndex.get(index);
            return day ? DAY_SHORT_LABELS[day] : "";
          }}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          unit=" kWh"
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_value, payload) => {
                const day = payload?.[0]?.payload?.day as
                  | SocPoint["day"]
                  | undefined;
                return day ? DAY_SHORT_LABELS[day] : "";
              }}
            />
          }
        />
        {trajectory
          .filter((point) => point.kind === "charge")
          .map((point) => (
            <ReferenceLine
              key={point.index}
              x={point.index}
              stroke="var(--color-kwh)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          ))}
        <Line
          dataKey="kwh"
          type="monotone"
          stroke="var(--color-kwh)"
          strokeWidth={2}
          dot={{ fill: "var(--color-kwh)", r: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
