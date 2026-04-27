// components/dashboard/DashboardClient.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Zap, Brain, MessageSquare, TrendingUp, Plus, RefreshCw, AlertTriangle, Clock, ArrowRight, Database } from "lucide-react";
import { formatCredits, statusClass, formatRelativeTime } from "@/lib/utils";
import UsageChart from "@/components/dashboard/UsageChart";
import TemplatesCarousel from "@/components/dashboard/TemplatesCarousel";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

interface DashboardData {
  user: { name: string | null; plan: string; creditsBalance: number; totalJobsRun: number; monthlyJobsUsed: number; };
  stats: { activeJobs: number; totalModels: number; totalJobsRun: number; tokensUsed30d: number; costUsd30d: number; totalDatasets: number; };
  recentJobs: Array<{ id: string; togetherJobId: string | null; modelSuffix: string; baseModel: string; status: string; progressPercent: number; createdAt: string; fineTunedModelId: string | null; }>;
  models: Array<{ id: string; name: string; baseModel: string; status: string; totalChats: number; createdAt: string; }>;
  creditActivity: Array<{ id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: string; }>;
  usageChart: Array<{ date: string; credits: number }>;
  generatedAt: string;
}

function StatCard({ label, value, sub, icon, href, color = "cyan" }: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; href: string; color?: "cyan" | "magenta" | "green" | "yellow";
}) {
  const colors = {
    cyan:    "text-cyan-neon",
    magenta: "text-magenta-neon",
    green:   "text-green-400",
    yellow:  "text-yellow-400",
  };
  return (
    <Link href={href}
      className="cyber-card p-5 block group animate-fade-up"
      style={{ textDecoration: "none" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] text-white/38 uppercase tracking-wider">{label}</span>
        <span className="opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
      </div>
      <div
        className={`font-bold text-2xl mb-1 transition-all group-hover:brightness-110 ${colors[color]}`}
        style={{ fontFamily: "Orbitron,sans-serif" }}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] text-white/32">{sub}</div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ backgroundImage: `linear-gradient(to right, transparent, currentColor, transparent)` }}
      />
    </Link>
  );
}

function SkeletonStatCard() {
  return (
    <div className="cyber-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-4 w-4 rounded" />
      </div>
      <div className="skeleton h-7 w-16 rounded mb-1.5" />
      <div className="skeleton h-2.5 w-24 rounded" />
    </div>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(data === null);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { signal: AbortSignal.timeout(15000) });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? `HTTP ${res.status}`); }
      const json = await res.json() as { success: boolean; data: DashboardData; error: string | null };
      if (!json.success || !json.data) throw new Error(json.error ?? "No data returned");
      setData(json.data);
      setLastRefresh(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load data. Please try again.";
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    fetchDashboard();
    // Smart refresh: 30s when tab visible, pause when hidden
    const startInterval = () => {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) fetchDashboard(true);
      }, 30_000);
    };
    startInterval();
    const handleVisibilityChange = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!document.hidden) { fetchDashboard(true); startInterval(); }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); document.removeEventListener("visibilitychange", handleVisibilityChange); };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div><div className="skeleton h-8 w-64 mb-2" /><div className="skeleton h-4 w-40" /></div>
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <SkeletonStatCard key={i} />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="cyber-card p-12 text-center animate-scale-in max-w-md mx-auto mt-8">
        <div className="w-14 h-14 rounded-2xl bg-red-400/8 border border-red-400/18 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="font-display text-base font-bold text-white mb-2">Dashboard unavailable</h2>
        <p className="font-body text-sm text-white/45 mb-6 leading-relaxed">
          We couldn&apos;t load your data right now. This is usually temporary — please try again.
        </p>
        <button
          onClick={() => fetchDashboard()}
          className="btn-neon px-6 py-2.5 rounded-xl text-sm mx-auto"
        >
          Try Again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { user, stats, recentJobs, models, creditActivity, usageChart } = data;
  const isNewUser = user.totalJobsRun === 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Onboarding for new users */}
      {isNewUser && <OnboardingFlow />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-white text-2xl mb-1" style={{ fontFamily: "Orbitron,sans-serif" }}>
            Welcome back, <span className="text-neon-cyan">{user.name?.split(" ")[0]?.toUpperCase() ?? "OPERATOR"}</span>
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-white/50">Your logistics command center</p>
            {lastRefresh && <span className="font-mono text-[10px] text-white/25">Updated {formatRelativeTime(lastRefresh.toISOString())}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchDashboard(true)} disabled={refreshing}
            className="btn-icon disabled:opacity-40" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Link href="/train" className="btn-neon text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
            <Plus className="w-4 h-4" /> Train Model
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Credits" value={formatCredits(user.creditsBalance)} sub={`${user.plan.toUpperCase()} plan · ${stats.totalDatasets} datasets`}
          icon={<Zap className="w-4 h-4 text-cyan-neon" />} href="/billing" color="cyan" />
        <StatCard label="Active Training" value={stats.activeJobs} sub={`${user.totalJobsRun} total jobs`}
          icon={<TrendingUp className="w-4 h-4 text-magenta-neon" />} href="/models" color="magenta" />
        <StatCard label="My Models" value={stats.totalModels} sub="ready for inference"
          icon={<Brain className="w-4 h-4 text-cyan-neon" />} href="/models" color="cyan" />
        <StatCard label="Tokens (30d)" value={stats.tokensUsed30d.toLocaleString("en-IN")} sub={`$${stats.costUsd30d.toFixed(4)} cost`}
          icon={<Database className="w-4 h-4 text-green-400" />} href="/billing" color="green" />
      </div>

      {/* Models + Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent models */}
        <div className="lg:col-span-2 cyber-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: "Orbitron,sans-serif" }}>Recent Models</h2>
            <Link href="/models" className="font-mono text-xs text-cyan-neon hover:opacity-80 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {models.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon"><Brain className="w-7 h-7 text-cyan-neon/40" /></div>
              <p className="font-bold text-white text-sm mb-1">No models yet</p>
              <p className="text-xs text-white/40 mb-4">Train your first logistics AI model</p>
              <Link href="/train" className="btn-neon text-xs px-5 py-2 rounded-lg">Start Training</Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {models.map(model => (
                <div key={model.id} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 hover:border-cyan-neon/12 hover:bg-white/1 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.15)" }}>
                      <Brain className="w-4 h-4 text-cyan-neon" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{model.name}</div>
                      <div className="font-mono text-[10px] text-white/35">{model.baseModel} · {model.totalChats} chats</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={statusClass(model.status)}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />{model.status}
                    </span>
                    <Link href={`/playground/${model.id}`} className="font-mono text-xs text-cyan-neon opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-80">
                      Chat →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="cyber-card p-5">
          <h2 className="font-bold text-white text-sm tracking-wide mb-5" style={{ fontFamily: "Orbitron,sans-serif" }}>Activity</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {[...recentJobs.map(j => ({ key: j.id, label: `Training ${j.modelSuffix}`, status: j.status, time: j.createdAt, type: "job" as const })),
              ...creditActivity.slice(0,6).map(c => ({ key: c.id, label: c.description, amount: c.amount, time: c.createdAt, type: "credit" as const }))
            ].sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0,10).map(item => (
              <div key={item.key} className="flex items-start gap-2.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  item.type === "job"
                    ? (item.status === "completed" ? "bg-green-400" : item.status === "failed" ? "bg-red-400" : "bg-cyan-neon animate-pulse")
                    : ((item.amount ?? 0) > 0 ? "bg-green-400" : "bg-magenta-neon")
                }`} />
                <div className="min-w-0">
                  <div className="text-white/70 truncate">{item.label}</div>
                  {item.type === "job" && "status" in item && (
                    <span className={`font-mono ${item.status === "completed" ? "text-green-400" : item.status === "failed" ? "text-red-400" : "text-yellow-400"}`}>
                      {item.status}
                    </span>
                  )}
                  {item.type === "credit" && "amount" in item && (
                    <span className={`font-mono font-bold ${(item.amount ?? 0) > 0 ? "text-green-400" : "text-magenta-neon"}`}>
                      {(item.amount ?? 0) > 0 ? "+" : ""}{item.amount} credits
                    </span>
                  )}
                  <div className="font-mono text-[10px] text-white/25 mt-0.5">{formatRelativeTime(item.time)}</div>
                </div>
              </div>
            ))}
            {recentJobs.length === 0 && creditActivity.length === 0 && (
              <p className="font-mono text-xs text-white/30 text-center py-6">No activity yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Usage chart */}
      {usageChart.length > 0 && (
        <div className="cyber-card p-5">
          <h2 className="font-bold text-white text-sm tracking-wide mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>Credit Usage — 30 Days</h2>
          <UsageChart transactions={creditActivity as never} />
        </div>
      )}

      {/* Templates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: "Orbitron,sans-serif" }}>Quick-Start Templates</h2>
          <Link href="/train" className="font-mono text-xs text-cyan-neon hover:opacity-80">Use template →</Link>
        </div>
        <TemplatesCarousel />
      </div>
    </div>
  );
}
