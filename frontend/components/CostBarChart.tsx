"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  cost: { label: "CZK / week" },
  fuel: { label: "Fuel", color: "#f59e0b" },
  electricity: { label: "Electricity", color: "var(--color-primary)" },
} satisfies ChartConfig;

interface CostBarChartProps {
  fuel: number;
  electricity: number;
}

export default function CostBarChart({ fuel, electricity }: CostBarChartProps) {
  const data = [
    {
      kind: "fuel",
      label: "Fuel",
      cost: fuel,
      costLabel: `${fuel} Kč`,
      fill: "var(--color-fuel)",
    },
    {
      kind: "electricity",
      label: "Electricity",
      cost: electricity,
      costLabel: `${electricity} Kč`,
      fill: "var(--color-electricity)",
    },
  ];

  return (
    <ChartContainer config={chartConfig} className="h-40 w-full">
      <BarChart data={data} margin={{ top: 18 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
        <YAxis hide domain={[0, "dataMax"]} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="cost" radius={6}>
          <LabelList
            dataKey="costLabel"
            position="top"
            className="fill-zinc-600 text-[11px]"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
