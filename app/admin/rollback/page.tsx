// app/admin/rollback/page.tsx — v6 NEW
// Rollback timeline with undo button, diff view (before vs after), expiry countdown

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { RotateCcw, Clock, AlertTriangle, CheckCircle, RefreshCw, History } from "lucide-react";

interface RollbackEntry {
  sessionId: string;
  action: string;
  resource: string;
  snapshotBefore: unknown;
  snapshotAfter: unknown;
  createdAt: string;
  expiresAt: string;
  minutesUntilExpiry: number;
}

function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  };
  const b = fmt(before);
  const a = fmt(after);
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <div className="p-3 rounded-lg bg-red-400/5 border border-red-400/15">
        <div className="font-mono text-[9px] text-red-400 mb-1.5 uppercase tracking-wider">Before</div>
        <code className="font-mono text-xs text-white/70 break-all">{b}</code>
      </div>
      <div className="p-3 rounded-lg bg-green-400/5 border border-green-400/15">
        <div className="font-mono text-[9px] text-green-400 mb-1.5 uppercase tracking-wider">After</div>
        <code className="font-mono text-xs text-white/70 break-all">{a ?? "—"}</code>
      </div>
    </div>
  );
}

export default function AdminRollbackPage() {
  const [entries, setEntries] = useState<RollbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<RollbackEntry | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rollback");
      const data = await res.json() as { rollbackable: RollbackEntry[] };
      setEntries(data.rollbackable ?? []);
    } catch {
      toast.error("Failed to load rollback logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const doRollback = async (entry: RollbackEntry) => {
    setConfirm(null);
    setRollingBack(entry.sessionId);
    try {
      const res = await fetch("/api/admin/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: entry.sessionId, reason: "Manual rollback from admin UI" }),
      });
      const data = await res.json() as { success: boolean; message: string };
      if (!res.ok || !data.success) throw new Error(data.message);
      toast.success(`Rolled back: ${data.message}`);
      await fetch_();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setRollingBack(null);
    }
  };

  const urgencyColor = (mins: number) =>
    mins < 60 ? "text-red-400" : mins < 240 ? "text-yellow-400" : "text-green-400";

  return (
    <>
      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="cyber-card p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-display text-base font-bold text-white">Undo this action?</h3>
            </div>
            <p className="font-body text-sm text-muted-foreground mb-2">
              Action: <span className="text-white font-mono text-xs">{confirm.action}</span>
            </p>
            <p className="font-body text-sm text-muted-foreground mb-6">
              Resource: <span className="text-cyan-neon font-mono text-xs">{confirm.resource}</span>
            </p>
            <DiffView before={confirm.snapshotBefore} after={confirm.snapshotAfter} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2 rounded border border-white/10 text-white/60 text-sm font-mono hover:bg-white/5 transition-all">CANCEL</button>
              <button onClick={() => doRollback(confirm)} className="flex-1 btn-neon-magenta py-2 rounded text-sm font-display font-bold">ROLLBACK</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-cyan-neon" />
            <div>
              <h1 className="font-display text-xl font-bold text-white">ROLLBACK TIMELINE</h1>
              <p className="font-mono text-xs text-muted-foreground">Undo recent AI actions · 24h expiry window</p>
            </div>
          </div>
          <button onClick={fetch_} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-cyan-neon animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="cyber-card p-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-50" />
            <p className="font-display text-sm font-bold text-white mb-1">Nothing to Rollback</p>
            <p className="font-mono text-xs text-muted-foreground">All recent AI actions have either expired or been rolled back.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.sessionId} className="cyber-card overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Timeline dot */}
                  <div className="w-2 h-2 rounded-full bg-cyan-neon flex-shrink-0 ring-2 ring-cyan-neon/20" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-white">{entry.action}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded border border-white/10 text-muted-foreground">
                        {entry.resource}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("en-IN")}
                      </span>
                      <span className={`flex items-center gap-1 font-mono text-[10px] ${urgencyColor(entry.minutesUntilExpiry)}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {entry.minutesUntilExpiry < 60
                          ? `${entry.minutesUntilExpiry}m left`
                          : `${Math.round(entry.minutesUntilExpiry / 60)}h left`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpanded(expanded === entry.sessionId ? null : entry.sessionId)}
                      className="px-3 py-1.5 rounded border border-white/10 text-white/60 hover:text-white font-mono text-xs transition-all"
                    >
                      {expanded === entry.sessionId ? "HIDE DIFF" : "VIEW DIFF"}
                    </button>
                    <button
                      onClick={() => setConfirm(entry)}
                      disabled={rollingBack === entry.sessionId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded btn-neon-magenta text-xs font-display font-bold disabled:opacity-40 transition-all active:scale-95"
                    >
                      <RotateCcw className={`w-3 h-3 ${rollingBack === entry.sessionId ? "animate-spin" : ""}`} />
                      {rollingBack === entry.sessionId ? "UNDOING..." : "UNDO"}
                    </button>
                  </div>
                </div>

                {expanded === entry.sessionId && (
                  <div className="px-5 pb-4 border-t border-white/5 pt-3">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">Session: {entry.sessionId}</p>
                    <DiffView before={entry.snapshotBefore} after={entry.snapshotAfter} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3 p-4 rounded border border-cyan-neon/10 bg-cyan-neon/5">
          <AlertTriangle className="w-4 h-4 text-cyan-neon flex-shrink-0 mt-0.5" />
          <p className="font-body text-xs text-muted-foreground">
            Rollback restores the exact value captured before the AI action executed. 
            Config rollbacks take effect within 5 minutes (cache TTL). 
            Credit rollbacks are immediate and create a transaction record.
            Each rollback is itself audited.
          </p>
        </div>
      </div>
    </>
  );
}
