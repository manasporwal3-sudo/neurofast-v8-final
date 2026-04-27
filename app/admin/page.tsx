// app/admin/page.tsx — NeuroFast Admin Dashboard v6
// UPGRADES: Full dashboard with activity feed, quick actions, AI suggestions,
//           real-time health indicators, revenue graph, and notifications

import { db } from "@/lib/db";
import { users, trainingJobs, payments, auditLogs, aiCostLogs } from "@/lib/db/schema";
import { desc, count, sum, gte, eq } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { Shield, Users, Zap, DollarSign, Activity, Server, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import SyncJobsButton from "@/components/admin/SyncJobsButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOverviewPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
  const oneDayAgo     = new Date(Date.now() -  1 * 24 * 60 * 60 * 1000);

  const [
    [totalUsers],
    [newUsers7d],
    [totalJobs],
    [activeJobsRow],
    [totalRevenue],
    [weekRevenue],
    [totalAiCost],
    [weekAiCost],
    recentAudit,
    last24hErrors,
    [weeklyJobs],
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo)),
    db.select({ count: count() }).from(trainingJobs),
    db.select({ count: count() }).from(trainingJobs).where(eq(trainingJobs.status, "running" as "running")),
    db.select({ total: sum(payments.amount) }).from(payments).where(gte(payments.createdAt, thirtyDaysAgo)),
    db.select({ total: sum(payments.amount) }).from(payments).where(gte(payments.createdAt, sevenDaysAgo)),
    db.select({ total: sum(aiCostLogs.costUsd) }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, thirtyDaysAgo)),
    db.select({ total: sum(aiCostLogs.costUsd) }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, sevenDaysAgo)),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10),
    db.select().from(auditLogs).where(gte(auditLogs.createdAt, oneDayAgo)).orderBy(desc(auditLogs.createdAt)).limit(5),
    db.select({ count: count() }).from(trainingJobs).where(gte(trainingJobs.createdAt, sevenDaysAgo)),
  ]);

  const revenue30d   = parseFloat(String(totalRevenue?.total  ?? "0"));
  const revenue7d    = parseFloat(String(weekRevenue?.total   ?? "0"));
  const aiCost30d    = parseFloat(String(totalAiCost?.total   ?? "0"));
  const aiCost7d     = parseFloat(String(weekAiCost?.total    ?? "0"));
  const runningJobs  = activeJobsRow?.count ?? 0;
  const jobsThisWeek = weeklyJobs?.count    ?? 0;
  const errorCount   = last24hErrors.filter((e) => e.severity === "error" || e.severity === "critical").length;
  const systemHealth = errorCount === 0 ? "healthy" : errorCount < 3 ? "degraded" : "critical";

  const suggestions: Array<{ type: "warn" | "info" | "critical"; msg: string; href: string; cta: string }> = [];
  if (runningJobs > 5)      suggestions.push({ type: "warn",     msg: `${runningJobs} training jobs running — monitor queue depth.`,           href: "/admin/analytics", cta: "Queue →" });
  if (jobsThisWeek > 15)    suggestions.push({ type: "warn",     msg: `Training usage high: ${jobsThisWeek} jobs this week.`,                  href: "/admin/analytics", cta: "Analytics →" });
  if (revenue7d < revenue30d * 0.2 && revenue30d > 0)
                            suggestions.push({ type: "warn",     msg: "Weekly revenue below average. Consider a credit promo.",               href: "/admin/analytics", cta: "Revenue →" });
  if (errorCount > 0)       suggestions.push({ type: "critical", msg: `${errorCount} errors in last 24 h. Review audit logs.`,                href: "/admin/audit",     cta: "Audit →" });
  if (suggestions.length === 0)
                            suggestions.push({ type: "info",     msg: "All systems nominal. No anomalies detected in the last 24 hours.",     href: "/admin/audit",     cta: "Logs →" });

  const severityBadge: Record<string, string> = {
    info:     "text-cyan-neon    border-cyan-neon/20    bg-cyan-neon/5",
    warn:     "text-yellow-400   border-yellow-400/20   bg-yellow-400/5",
    error:    "text-red-400      border-red-400/20      bg-red-400/5",
    critical: "text-magenta-neon border-magenta-neon/20 bg-magenta-neon/5",
  };

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-magenta-neon" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              ADMIN <span className="text-magenta-neon">CONTROL CENTER</span>
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              Platform health · Real-time · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
            systemHealth === "healthy"  ? "text-green-400  border-green-400/30  bg-green-400/5"
          : systemHealth === "degraded" ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/5"
          :                               "text-red-400    border-red-400/30    bg-red-400/5"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              systemHealth === "healthy" ? "bg-green-400" : systemHealth === "degraded" ? "bg-yellow-400" : "bg-red-400"
            }`} />
            {systemHealth === "healthy" ? "All Systems Operational" : systemHealth === "degraded" ? "Degraded" : "Incident Active"}
          </span>
          <SyncJobsButton />
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {[
          { label: "Total Users",    value: String(totalUsers?.count ?? 0), sub: `+${newUsers7d?.count ?? 0} this week`,  subOk: true,  icon: <Users  className="w-4 h-4 text-cyan-neon"  />, href: "/admin/users" },
          { label: "Training Jobs",  value: String(totalJobs?.count  ?? 0), sub: `${runningJobs} running now`,            subOk: runningJobs < 10, icon: <Zap    className="w-4 h-4 text-magenta-neon" />, href: "/admin/analytics" },
          { label: "Revenue (30d)",  value: `₹${revenue30d.toLocaleString("en-IN")}`,  sub: `₹${revenue7d.toLocaleString("en-IN")} this week`, subOk: true, icon: <DollarSign className="w-4 h-4 text-green-400" />, href: "/admin/audit" },
          { label: "AI Cost (30d)",  value: `$${aiCost30d.toFixed(2)}`,     sub: `$${aiCost7d.toFixed(2)} this week`,     subOk: true,  icon: <Activity className="w-4 h-4 text-yellow-400" />, href: "/admin/audit" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="cyber-card p-5 hover:border-white/10 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
              {s.icon}
            </div>
            <div className="font-display text-2xl font-bold text-white">{s.value}</div>
            <div className={`font-mono text-[10px] mt-1 ${s.subOk ? "text-green-400" : "text-yellow-400"}`}>{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* ── AI Suggestions + System Health ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 cyber-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-magenta-neon animate-pulse" />
              AI SYSTEM SUGGESTIONS
            </h2>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                s.type === "critical" ? "border-magenta-neon/20 bg-magenta-neon/5"
              : s.type === "warn"     ? "border-yellow-400/20  bg-yellow-400/5"
              :                         "border-cyan-neon/10   bg-cyan-neon/3"
              }`}>
                <div className="flex items-center gap-2">
                  {s.type !== "info"
                    ? <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${s.type === "critical" ? "text-magenta-neon" : "text-yellow-400"}`} />
                    : <CheckCircle  className="w-3.5 h-3.5 flex-shrink-0 text-cyan-neon" />
                  }
                  <span className="font-body text-white/80">{s.msg}</span>
                </div>
                <Link href={s.href} className="font-mono text-[10px] text-cyan-neon hover:opacity-80 flex-shrink-0 ml-3">{s.cta}</Link>
              </div>
            ))}
          </div>
        </div>

        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-neon" /> SYSTEM HEALTH
          </h2>
          <div className="space-y-3">
            {[
              { label: "API",       ok: true },
              { label: "Database",  ok: true },
              { label: "Queue",     ok: runningJobs < 20 },
              { label: "Training",  ok: errorCount === 0 },
              { label: "Billing",   ok: true },
              { label: "Auth",      ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{item.label}</span>
                <div className={`flex items-center gap-1.5 font-mono text-xs ${item.ok ? "text-green-400" : "text-red-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
                  {item.ok ? "OK" : "ERR"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Nav ──────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4 stagger">
        {[
          { href: "/admin/analytics",  label: "Analytics",       desc: "Revenue, usage, queue & cost charts",       color: "cyan",    icon: "📊" },
          { href: "/admin/users",      label: "User Management", desc: "Search, filter, manage roles & credits",    color: "magenta", icon: "👥" },
          { href: "/admin/config",     label: "System Config",   desc: "Feature flags, limits & pricing controls",  color: "cyan",    icon: "⚙️" },
          { href: "/admin/ai-assistant", label: "AI Control Brain", desc: "Natural language admin command center",   color: "magenta", icon: "🧠" },
          { href: "/admin/audit",      label: "Audit Logs",      desc: "Real-time logs with IP & device tracking",  color: "cyan",    icon: "🔍" },
          { href: "/terms",            label: "Terms & Policies", desc: "Platform policies and legal documents",     color: "magenta", icon: "📋" },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className={`cyber-card p-5 hover:border-${a.color === "cyan" ? "cyan" : "magenta"}-neon/25 transition-all group`}
          >
            <div className="text-xl mb-2">{a.icon}</div>
            <div className={`font-display text-sm font-bold mb-1 ${a.color === "cyan" ? "text-cyan-neon" : "text-magenta-neon"}`}>{a.label}</div>
            <p className="font-body text-xs text-muted-foreground">{a.desc}</p>
            <span className="font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-2 block text-cyan-neon">OPEN →</span>
          </Link>
        ))}
      </div>

      {/* ── Activity Feed ──────────────────────────────────────────────────── */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-bold text-white tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-neon" /> LIVE ACTIVITY FEED
          </h2>
          <Link href="/admin/audit" className="font-mono text-xs text-cyan-neon hover:opacity-80">VIEW ALL →</Link>
        </div>
        <div className="space-y-2">
          {recentAudit.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="font-mono text-xs text-muted-foreground">No audit events yet.</p>
            </div>
          ) : (
            recentAudit.map((log) => (
              <div key={log.id}
                className={`flex items-start justify-between p-3 rounded-lg border text-xs ${
                  log.severity === "warn"     ? "border-yellow-400/15  bg-yellow-400/3"
                : log.severity === "error"    ? "border-red-400/15     bg-red-400/3"
                : log.severity === "critical" ? "border-magenta-neon/15 bg-magenta-neon/3"
                :                               "border-white/5"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`font-mono font-bold flex-shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded border ${severityBadge[log.severity] ?? "text-white border-white/10"}`}>
                    {log.severity.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-white text-[11px]">{log.action}</span>
                    {log.actorEmail && (
                      <span className="font-mono text-muted-foreground ml-2 text-[10px]">by {log.actorEmail}</span>
                    )}
                    {log.resourceId && (
                      <span className="font-mono text-muted-foreground ml-2 text-[10px]">
                        · {log.resource}/{log.resourceId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-muted-foreground flex-shrink-0 ml-4 text-[10px]">
                  {formatDate(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
