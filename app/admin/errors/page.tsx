// app/admin/errors/page.tsx — v6 NEW
// Error monitoring panel: recent errors, failure rates, queue failures

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, TrendingDown, Activity, Zap, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  actorEmail: string | null;
  resource: string | null;
  resourceId: string | null;
  severity: string;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
}
interface QueueStats {
  bullmq?: { available: boolean; training?: { waiting: number; active: number; completed: number; failed: number } };
  db: { running: number; queued: number; completed: number; failed: number };
}

export default function AdminErrorsPage() {
  const [errors, setErrors] = useState<AuditLog[]>([]);
  const [queue, setQueue] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const [auditRes, queueRes] = await Promise.all([
        fetch("/api/admin/audit?severity=error&limit=30&page=1"),
        fetch("/api/admin/queue-stats"),
      ]);
      const auditData = await auditRes.json() as { logs: AuditLog[] };
      const queueData = await queueRes.json() as QueueStats;
      setErrors(auditData.logs ?? []);
      setQueue(queueData);
    } catch {
      toast.error("Failed to load error data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const criticalCount = errors.filter((e) => e.severity === "critical").length;
  const errorCount    = errors.filter((e) => e.severity === "error").length;
  const queueFailed   = queue?.db.failed ?? 0;
  const queueRunning  = queue?.db.running ?? 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <h1 className="font-display text-xl font-bold text-white">ERROR MONITORING</h1>
            <p className="font-mono text-xs text-muted-foreground">Recent errors · Queue failures · Failure rates</p>
          </div>
        </div>
        <button onClick={fetch_} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Critical Events",  value: criticalCount, icon: <XCircle className="w-4 h-4 text-magenta-neon" />, bad: criticalCount > 0 },
          { label: "Error Events",     value: errorCount,    icon: <AlertTriangle className="w-4 h-4 text-red-400" />, bad: errorCount > 5 },
          { label: "Queue Failures",   value: queueFailed,   icon: <TrendingDown className="w-4 h-4 text-yellow-400" />, bad: queueFailed > 0 },
          { label: "Active Jobs",      value: queueRunning,  icon: <Activity className="w-4 h-4 text-cyan-neon" />, bad: false },
        ].map((s) => (
          <div key={s.label} className={`cyber-card p-5 ${s.bad ? "border-red-400/20" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
              {s.icon}
            </div>
            <div className={`font-display text-3xl font-bold ${s.bad && s.value > 0 ? "text-red-400" : "text-white"}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Queue breakdown */}
      {queue && (
        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-neon" /> QUEUE MONITOR
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Waiting",   value: queue.db.queued,    color: "text-yellow-400" },
              { label: "Running",   value: queue.db.running,   color: "text-cyan-neon" },
              { label: "Completed", value: queue.db.completed, color: "text-green-400" },
              { label: "Failed",    value: queue.db.failed,    color: "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-lg bg-void-400 border border-white/5">
                <div className={`font-display text-2xl font-bold ${s.color} mb-1`}>{s.value}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
          {queue.bullmq?.available === false && (
            <div className="mt-3 p-3 rounded border border-yellow-400/20 bg-yellow-400/5">
              <p className="font-mono text-xs text-yellow-400">⚠ BullMQ not connected — showing DB stats only. Configure UPSTASH_REDIS for full queue monitoring.</p>
            </div>
          )}
        </div>
      )}

      {/* Recent errors */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-bold text-white tracking-wider">RECENT ERRORS</h2>
          <span className="font-mono text-[10px] text-muted-foreground">{errors.length} events</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 text-cyan-neon animate-spin" />
          </div>
        ) : errors.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="w-8 h-8 text-green-400 mx-auto mb-2 opacity-50" />
            <p className="font-mono text-xs text-muted-foreground">No errors in recent logs. System healthy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((log) => (
              <div key={log.id} className="rounded-lg border border-red-400/15 bg-red-400/3">
                <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <span className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${
                    log.severity === "critical"
                      ? "text-magenta-neon border-magenta-neon/30 bg-magenta-neon/10"
                      : "text-red-400 border-red-400/30 bg-red-400/10"
                  }`}>
                    {log.severity.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm text-white">{log.action}</span>
                    {log.actorEmail && <span className="font-mono text-xs text-muted-foreground ml-2">by {log.actorEmail}</span>}
                    {log.ipAddress && <span className="font-mono text-xs text-muted-foreground ml-2">· {log.ipAddress}</span>}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">{formatDate(log.createdAt)}</span>
                </div>
                {expanded === log.id && log.metadata && (
                  <div className="px-3 pb-3 border-t border-red-400/10 pt-2">
                    <pre className="font-mono text-[10px] text-white/50 bg-void-500 rounded p-2 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
