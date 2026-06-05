"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ALL_DAYS, DAY_SHORT_LABELS, type DayOfWeek } from "@/lib/plan";

const chartConfig = {
  kwh: {
    label: "Battery",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

interface BatteryChartProps {
  dailyPeak: Record<DayOfWeek, number>;
}

export default function BatteryChart({ dailyPeak }: BatteryChartProps) {
  const data = ALL_DAYS.map((day) => ({
    day: DAY_SHORT_LABELS[day],
    kwh: dailyPeak[day] ?? 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          unit=" kWh"
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          dataKey="kwh"
          type="monotone"
          stroke="var(--color-kwh)"
          strokeWidth={2}
          dot={{ fill: "var(--color-kwh)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
