"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { formatPLN } from "@/lib/format";

const BRAND = "#50e089";
const PALETTE = [
  "#50e089",
  "#0c0f0c",
  "#17b268",
  "#a6f4c1",
  "#e3a72e",
  "#0d7a46",
  "#74e9a1",
  "#667066",
];

function money(v: number) {
  return formatPLN(v);
}

export function WeeklyBarChart({
  data,
}: {
  data: { label: string; amount: number; count: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#78716c", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            tickLine={false}
            axisLine={false}
            width={38}
            tick={{ fill: "#a8a29e", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(80,224,137,0.12)" }}
            formatter={(v) => [money(Number(v)), "Sprzedaż"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e7e5e4",
              fontSize: 13,
            }}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill={BRAND} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SplitDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={54}
            outerRadius={84}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [money(Number(v)), n as string]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e7e5e4",
              fontSize: 13,
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "#78716c" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
