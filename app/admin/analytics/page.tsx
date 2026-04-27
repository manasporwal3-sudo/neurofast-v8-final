// app/admin/analytics/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { RefreshCw, TrendingUp, Users, DollarSign, Cpu, AlertTriangle, Activity, Database, Zap } from "lucide-react";

interface AnalyticsData {
  period: { days: number; since: string };
  users: {
    total: number;
    newInPeriod: number;
    daily: Array<{ date: string; newUsers: number }>;
  };
  revenue: {
    totalAllTimeInr: number;
    inPeriodInr: number;
    daily: Array<{ date: string; inr: number; transactions: number }>;
  };
  aiCost: {
    totalUsd: number;
    byModel: Array<{ model: string; callType: string; costUsd: number; tokens: number; calls: number }>;
  };
  training: {
    totalAllTime: number;
    completedInPeriod: number;
    failedInPeriod: number;
    currentlyRunning: number;
    successRatePercent: number | null;
    activeModels: number;
  };
  credits: { purchasedInPeriod: number; spentInPeriod: number; netFlowInPeriod: number };
  errors: { countInPeriod: number };
  topUsers: Array<{ userId: string; email: string; name: string | null; jobCount: number; plan: string; creditsBalance: number }>;
  recentActivity: Array<{ id: string; action: string; severity: string; actorEmail: string | null; resource: string | null; createdAt: string }>;
  queue: { available: boolean; training?: { waiting: number; active: number; completed: number; failed: number; delayed: number }; dlq?: { waiting: number; failed: number } };
  generatedAt: string;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-void-300 border border-cyan-neon/20 rounded p-3 text-xs">
      <p className="font-mono text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-cyan-neon",
  warn: "bg-yellow-400",
  error: "bg-red-400",
  critical: "bg-magenta-neon",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as AnalyticsData;
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load analytics data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 60_000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 text-cyan-neon animate-spin mr-3" />
        <span className="font-mono text-cyan-neon text-sm">LOADING ANALYTICS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-6 rounded border border-red-500/20 bg-red-500/5">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <div>
          <p className="font-mono text-red-400 text-sm font-bold">Failed to load analytics</p>
          <p className="font-mono text-xs text-muted-foreground">{error}</p>
          <button onClick={fetchAnalytics} className="font-mono text-xs text-cyan-neon mt-2 hover:opacity-80">
            RETRY →
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-cyan-neon" />
          <div>
            <h1 className="font-display text-xl font-bold text-white">REAL-TIME ANALYTICS</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {lastRefreshed ? `Last updated: ${lastRefreshed.toLocaleTimeString()}` : ""} · Auto-refreshes every 60s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="bg-void-400 border border-white/10 rounded px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-cyan-neon/40"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Users",
            value: data.users.total.toLocaleString("en-IN"),
            sub: `+${data.users.newInPeriod} in ${days}d`,
            icon: <Users className="w-4 h-4 text-cyan-neon" />,
            color: "cyan",
          },
          {
            label: `Revenue (${days}d)`,
            value: `₹${data.revenue.inPeriodInr.toLocaleString("en-IN")}`,
            sub: `₹${data.revenue.totalAllTimeInr.toLocaleString("en-IN")} all time`,
            icon: <DollarSign className="w-4 h-4 text-green-400" />,
            color: "green",
          },
          {
            label: "AI Cost (all time)",
            value: `$${data.aiCost.totalUsd.toFixed(3)}`,
            sub: `${(data.revenue.totalAllTimeInr * 0.012 / Math.max(data.aiCost.totalUsd, 0.001)).toFixed(1)}x margin`,
            icon: <Cpu className="w-4 h-4 text-magenta-neon" />,
            color: "magenta",
          },
          {
            label: "Training Success",
            value: data.training.successRatePercent !== null ? `${data.training.successRatePercent}%` : "N/A",
            sub: `${data.training.completedInPeriod} done · ${data.training.failedInPeriod} failed`,
            icon: <Zap className="w-4 h-4 text-yellow-400" />,
            color: "yellow",
          },
        ].map((stat) => (
          <div key={stat.label} className="cyber-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="font-display text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Queue status */}
      <div className="cyber-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-cyan-neon" />
          <h2 className="font-display text-sm font-bold text-white tracking-wider">QUEUE STATUS</h2>
          <span className={`ml-2 font-mono text-[10px] px-2 py-0.5 rounded ${data.queue.available ? "text-green-400 bg-green-400/10 border border-green-400/20" : "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20"}`}>
            {data.queue.available ? "REDIS CONNECTED" : "REDIS UNAVAILABLE (using direct mode)"}
          </span>
        </div>
        {data.queue.available && data.queue.training ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Waiting", value: data.queue.training.waiting, color: "text-yellow-400" },
              { label: "Active", value: data.queue.training.active, color: "text-cyan-neon" },
              { label: "Delayed", value: data.queue.training.delayed, color: "text-orange-400" },
              { label: "Completed", value: data.queue.training.completed, color: "text-green-400" },
              { label: "Failed", value: data.queue.training.failed, color: "text-red-400" },
            ].map((q) => (
              <div key={q.label} className="bg-void-400 rounded p-3 text-center border border-white/5">
                <div className={`font-display text-xl font-bold ${q.color}`}>{q.value}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-1">{q.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-void-400 rounded p-3 text-center border border-white/5">
              <div className="font-display text-xl font-bold text-cyan-neon">{data.training.currentlyRunning}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">Running (DB)</div>
            </div>
            <div className="bg-void-400 rounded p-3 text-center border border-white/5">
              <div className="font-display text-xl font-bold text-green-400">{data.training.activeModels}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">Active Models</div>
            </div>
          </div>
        )}
        {data.queue.available && data.queue.dlq && (data.queue.dlq.waiting > 0 || data.queue.dlq.failed > 0) && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded border border-red-500/20 bg-red-500/5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="font-mono text-xs text-red-400">
              Dead Letter Queue: {data.queue.dlq.waiting} waiting · {data.queue.dlq.failed} failed — requires manual review
            </span>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* User growth */}
        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">USER GROWTH</h2>
          {data.users.daily.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground">No user data in this period</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.users.daily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#4a5568" }} axisLine={false} tickLine={false} interval={Math.floor(data.users.daily.length / 6)} />
                <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#4a5568" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="newUsers" name="New Users" stroke="#00f0ff" strokeWidth={1.5} fill="url(#userGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue */}
        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">DAILY REVENUE (₹)</h2>
          {data.revenue.daily.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground">No revenue in this period</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.revenue.daily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#4a5568" }} axisLine={false} tickLine={false} interval={Math.floor(data.revenue.daily.length / 6)} />
                <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "#4a5568" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="inr" name="Revenue (₹)" fill="#00f0ff" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* AI cost breakdown */}
      {data.aiCost.byModel.length > 0 && (
        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">AI COST BY MODEL</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Model", "Type", "Calls", "Tokens", "Cost (USD)"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.aiCost.byModel.map((row, i) => (
                  <tr key={i} className="hover:bg-white/2">
                    <td className="px-3 py-2 font-mono text-xs text-white">{row.model.split("/")[1] ?? row.model}</td>
                    <td className="px-3 py-2">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${row.callType === "inference" ? "text-cyan-neon border-cyan-neon/20 bg-cyan-neon/5" : "text-magenta-neon border-magenta-neon/20 bg-magenta-neon/5"}`}>
                        {row.callType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-sm text-white/70">{row.calls.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-sm text-white/70">{row.tokens.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-sm text-green-400">${row.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom row: Top users + Activity feed */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top users */}
        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">TOP USERS BY TRAINING JOBS</h2>
          {data.topUsers.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground text-center py-6">No training jobs in this period</p>
          ) : (
            <div className="space-y-3">
              {data.topUsers.map((u, i) => (
                <div key={u.userId} className="flex items-center justify-between p-3 rounded bg-void-400 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg font-bold text-white/20 w-6">{i + 1}</span>
                    <div>
                      <div className="font-body text-sm text-white">{u.name ?? u.email}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{u.email} · {u.plan}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-sm font-bold text-cyan-neon">{u.jobCount} jobs</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{u.creditsBalance} credits</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live activity feed */}
        <div className="cyber-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-cyan-neon" />
            <h2 className="font-display text-sm font-bold text-white tracking-wider">LIVE ACTIVITY</h2>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-1" />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${SEVERITY_DOT[log.severity] ?? "bg-white/20"}`} />
                <div className="min-w-0">
                  <span className="font-mono text-white/80">{log.action}</span>
                  {log.actorEmail && (
                    <span className="font-mono text-muted-foreground ml-1">· {log.actorEmail}</span>
                  )}
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
