// components/dashboard/UsageChart.tsx
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CreditTransaction } from "@/lib/db/schema";

interface UsageChartProps {
  transactions: CreditTransaction[];
}

// Aggregate transactions by day
function buildChartData(transactions: CreditTransaction[]) {
  const map = new Map<string, number>();

  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    map.set(key, 0);
  }

  transactions.forEach((tx) => {
    if (tx.amount < 0) {
      const key = new Date(tx.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount));
    }
  });

  return Array.from(map.entries()).map(([date, credits]) => ({ date, credits }));
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-void-300 border border-cyan-neon/20 rounded p-3">
        <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
        <p className="font-mono text-sm text-cyan-neon font-bold">{payload[0].value} credits</p>
      </div>
    );
  }
  return null;
};

export default function UsageChart({ transactions }: UsageChartProps) {
  const data = buildChartData(transactions);
  const hasData = data.some((d) => d.credits > 0);

  if (!hasData) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="font-mono text-xs text-muted-foreground">No credit usage yet — train your first model!</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#4a5568" }}
          axisLine={false}
          tickLine={false}
          interval={6}
        />
        <YAxis
          tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#4a5568" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="credits"
          stroke="#00f0ff"
          strokeWidth={1.5}
          fill="url(#cyanGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
