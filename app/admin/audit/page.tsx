// app/admin/audit/page.tsx — v6 UPGRADE
// Added: search, severity filter, action filter, IP display, metadata expand, auto-refresh

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Activity, RefreshCw, Search, Filter, X, ChevronDown, ChevronRight, Globe } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AuditLog {
  id: string;
  actorEmail: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: unknown;
  severity: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info:     "text-cyan-neon    bg-cyan-neon/10    border-cyan-neon/20",
  warn:     "text-yellow-400   bg-yellow-400/10   border-yellow-400/20",
  error:    "text-red-400      bg-red-400/10      border-red-400/20",
  critical: "text-magenta-neon bg-magenta-neon/10 border-magenta-neon/20",
};

const SEVERITY_ROW: Record<string, string> = {
  warn:     "bg-yellow-400/3",
  error:    "bg-red-400/3",
  critical: "bg-magenta-neon/3",
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterAction)   params.set("action", filterAction);
      const res  = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json() as { logs: AuditLog[]; hasMore: boolean };
      setLogs(data.logs);
      setHasMore(data.hasMore);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, filterSeverity, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  // Client-side search
  const filtered = search
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        (l.actorEmail?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (l.ipAddress ?? "").includes(search) ||
        (l.resource ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const severityCounts = logs.reduce((acc, l) => {
    acc[l.severity] = (acc[l.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-neon" />
          <div>
            <h1 className="font-display text-xl font-bold text-white">AUDIT LOGS</h1>
            <p className="font-mono text-xs text-muted-foreground">Full platform action history · IP + device tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono transition-all ${
              autoRefresh
                ? "border-cyan-neon/30 bg-cyan-neon/10 text-cyan-neon"
                : "border-white/10 text-muted-foreground hover:text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-cyan-neon animate-pulse" : "bg-white/20"}`} />
            {autoRefresh ? "LIVE" : "Auto"}
          </button>
          <button onClick={fetchLogs} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Severity quick-filter pills */}
      <div className="flex flex-wrap gap-2">
        {["", "info", "warn", "error", "critical"].map((sev) => (
          <button
            key={sev}
            onClick={() => { setFilterSeverity(sev); setPage(1); }}
            className={`px-3 py-1.5 rounded-full font-mono text-xs border transition-all ${
              filterSeverity === sev
                ? sev ? SEVERITY_STYLES[sev] : "border-white/30 bg-white/10 text-white"
                : "border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
            }`}
          >
            {sev ? `${sev.toUpperCase()} ${severityCounts[sev] ? `(${severityCounts[sev]})` : ""}` : `ALL (${logs.length})`}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search action, email, IP, resource…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-void-500 border border-white/10 rounded px-3 py-2 pl-9 font-mono text-xs text-white placeholder-white/25 focus:outline-none focus:border-cyan-neon/40 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-muted-foreground hover:text-white" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Filter by action…"
            value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="bg-void-500 border border-white/10 rounded px-3 py-2 font-mono text-xs text-white placeholder-white/25 focus:outline-none focus:border-cyan-neon/40 w-40 transition-colors"
          />
        </div>
        <div className="flex items-center px-3 py-2 rounded border border-white/5 font-mono text-xs text-muted-foreground">
          {filtered.length} events
        </div>
      </div>

      {/* Logs table */}
      <div className="cyber-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 text-cyan-neon animate-spin mr-2" />
            <span className="font-mono text-xs text-muted-foreground">LOADING LOGS...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
            <p className="font-mono text-xs text-muted-foreground">
              {search || filterSeverity || filterAction ? "No logs match your filters." : "No audit events yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((log) => (
              <div key={log.id} className={SEVERITY_ROW[log.severity] ?? ""}>
                {/* Main row */}
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/2 transition-colors"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <span className={`font-mono font-bold text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${SEVERITY_STYLES[log.severity] ?? "text-white border-white/10"}`}>
                    {log.severity.toUpperCase()}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-white">{log.action}</span>
                      {log.resource && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          · {log.resource}{log.resourceId ? `/${log.resourceId.slice(0, 8)}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {log.actorEmail && (
                        <span className="font-mono text-[10px] text-muted-foreground">{log.actorEmail}</span>
                      )}
                      {log.ipAddress && (
                        <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5" />{log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    <span className="font-mono text-[10px] text-muted-foreground">{formatDate(log.createdAt)}</span>
                    {expandedId === log.id
                      ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </div>
                </div>

                {/* Expanded metadata */}
                {expandedId === log.id && (
                  <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-2">
                    {log.userAgent && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        <span className="text-white/40">UA:</span> {log.userAgent.slice(0, 120)}
                      </p>
                    )}
                    {log.metadata && (
                      <pre className="font-mono text-[10px] text-white/50 bg-void-500 rounded p-3 overflow-x-auto max-h-40">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-white/5">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="font-mono text-xs text-muted-foreground disabled:opacity-30 hover:text-white transition-colors">
              ← PREV
            </button>
            <span className="font-mono text-xs text-muted-foreground">Page {page}</span>
            <button disabled={!hasMore} onClick={() => setPage((p) => p + 1)}
              className="font-mono text-xs text-muted-foreground disabled:opacity-30 hover:text-white transition-colors">
              NEXT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
