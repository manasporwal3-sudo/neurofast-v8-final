// app/admin/ai-assistant/page.tsx
// AI CONTROL BRAIN — Complete UI with confidence, clarification, multi-step, dry-run, rollback
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Cpu, CheckCircle, XCircle, AlertTriangle, Shield, Loader2, History, ChevronRight, RotateCcw, ArrowRight, Zap, Settings, Users, Eye, RefreshCw } from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ParsedIntent { action: string; parameters: Record<string, unknown>; reasoning: string; confidence: number; requiresApproval: boolean; warnings?: string[]; }
interface ParseResult {
  success: boolean; type?: string; sessionId?: string;
  intent?: ParsedIntent; intents?: ParsedIntent[];
  message?: string; questions?: string[]; partialAction?: string;
  reason?: string; confidence?: number; suggestions?: string[];
  risk?: string; overallRisk?: string; warnings?: string[];
  overallConfidence?: number; stepCount?: number; error?: string;
}
interface ExecuteResult { success: boolean; message: string; before?: unknown; after?: unknown; sessionId?: string; dryRun?: boolean; rollbackAvailable?: boolean; }
interface BrainSession { id: string; prompt: string; parseResult: ParseResult; status: "pending"|"dry_run"|"executed"|"failed"|"rejected"; execResult?: ExecuteResult; ts: number; }
interface RollbackLog { sessionId: string; action: string; resource: string; snapshotBefore: unknown; snapshotAfter: unknown; createdAt: string; minutesUntilExpiry: number; }

const ACTION_META: Record<string, { label: string; risk: "low"|"medium"|"high"; color: string }> = {
  update_pricing:     { label: "Pricing",       risk: "high",   color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8" },
  toggle_feature:     { label: "Feature Flag",  risk: "medium", color: "text-cyan-neon border-cyan-neon/30 bg-cyan-neon/8" },
  update_limits:      { label: "Limits",        risk: "medium", color: "text-orange-400 border-orange-400/30 bg-orange-400/8" },
  add_credits:        { label: "Add Credits",   risk: "low",    color: "text-green-400 border-green-400/30 bg-green-400/8" },
  change_user_role:   { label: "User Role",     risk: "high",   color: "text-magenta-neon border-magenta-neon/30 bg-magenta-neon/8" },
  flag_user:          { label: "Flag User",     risk: "medium", color: "text-red-400 border-red-400/30 bg-red-400/8" },
  toggle_maintenance: { label: "Maintenance",   risk: "high",   color: "text-red-400 border-red-400/30 bg-red-400/8" },
  update_rate_limit:  { label: "Rate Limit",    risk: "low",    color: "text-cyan-neon border-cyan-neon/30 bg-cyan-neon/8" },
  send_notification:  { label: "Notification",  risk: "low",    color: "text-blue-400 border-blue-400/30 bg-blue-400/8" },
};

const RISK_BADGE: Record<string, string> = {
  low:    "text-green-400 bg-green-400/10 border border-green-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
  high:   "text-red-400 bg-red-400/10 border border-red-400/20",
};

const EXAMPLES = [
  "Enable maintenance mode",
  "Set free tier to 2 training jobs/month",
  "Reduce chat rate limit to 10 messages/min",
  "Increase signup credits to 200",
  "Disable new user registration",
  "Set inference cost to 2 credits per message",
];

// ─── CONFIDENCE METER ────────────────────────────────────────────────────────
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "bg-green-400" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
  const label = pct >= 80 ? "High" : pct >= 60 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
        {pct}% {label}
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AiBrainPage() {
  const [prompt, setPrompt] = useState("");
  const [parsing, setParsing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [current, setCurrent] = useState<BrainSession | null>(null);
  const [history, setHistory] = useState<BrainSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [rollbacks, setRollbacks] = useState<RollbackLog[]>([]);
  const [loadingRollbacks, setLoadingRollbacks] = useState(false);
  const [highRiskConfirmed, setHighRiskConfirmed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const loadRollbacks = useCallback(async () => {
    setLoadingRollbacks(true);
    try {
      const res = await fetch("/api/admin/rollback");
      const d = await res.json() as { rollbackable: RollbackLog[] };
      setRollbacks(d.rollbackable ?? []);
    } catch { toast.error("Failed to load rollbacks"); }
    finally { setLoadingRollbacks(false); }
  }, []);

  useEffect(() => { if (showRollback) loadRollbacks(); }, [showRollback, loadRollbacks]);

  const handleParse = async () => {
    const text = prompt.trim();
    if (!text || parsing) return;
    setParsing(true); setCurrent(null); setHighRiskConfirmed(false);
    try {
      const res = await fetch("/api/admin/ai-brain?action=parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const d = await res.json() as ParseResult;
      setCurrent({ id: Math.random().toString(36).slice(2,10), prompt: text, parseResult: d, status: "pending", ts: Date.now() });
      setPrompt("");
      if (d.type === "clarification") toast.info("Clarification needed — see questions below");
      else if (d.type === "low_confidence") toast.warning("Low confidence — please be more specific");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Parse failed"); }
    finally { setParsing(false); }
  };

  const doExecute = async (dryRun: boolean) => {
    if (!current || !current.parseResult.sessionId) return;
    const pr = current.parseResult;
    const intent = pr.intent ?? (pr.intents ? pr.intents[0] : null);
    if (!intent) return;

    if (dryRun) setDryRunning(true); else setExecuting(true);

    const endpoint = pr.type === "multi_intent" ? "multi-execute" : "execute";
    const body = pr.type === "multi_intent"
      ? { intents: pr.intents, sessionId: pr.sessionId, adminConfirmed: highRiskConfirmed, dryRun }
      : { intent, adminConfirmed: true, sessionId: pr.sessionId, highRiskConfirmed, dryRun };

    try {
      const res = await fetch(`/api/admin/ai-brain?action=${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as ExecuteResult & { error?: string };

      if (res.status === 428) {
        toast.error("HIGH RISK: Tick the confirmation checkbox and try again");
        return;
      }

      const updated: BrainSession = { ...current, status: dryRun ? "dry_run" : (d.success ? "executed" : "failed"), execResult: d };
      setCurrent(updated);
      setHistory(p => [updated, ...p.slice(0,49)]);

      if (dryRun) toast.info("[DRY RUN] " + d.message);
      else if (d.success) { toast.success("Action executed: " + d.message); if (d.rollbackAvailable) setShowRollback(true); }
      else toast.error("Failed: " + (d.message ?? d.error));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setDryRunning(false); setExecuting(false); }
  };

  const doRollback = async (sessionId: string) => {
    if (!confirm("Restore the previous value for this action?")) return;
    try {
      const res = await fetch("/api/admin/rollback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, reason: "Admin manual rollback" }),
      });
      const d = await res.json() as { success: boolean; message: string };
      if (d.success) { toast.success(d.message); loadRollbacks(); }
      else toast.error(d.message);
    } catch { toast.error("Rollback failed"); }
  };

  const reject = () => {
    if (!current) return;
    const r = { ...current, status: "rejected" as const };
    setCurrent(r); setHistory(p => [r, ...p.slice(0,49)]); toast.info("Rejected.");
  };

  const pr = current?.parseResult;
  const intent = pr?.intent ?? (pr?.intents?.[0] ?? null);
  const meta = intent ? (ACTION_META[intent.action] ?? { label: intent.action, risk: "medium" as const, color: "text-white border-white/20 bg-white/5" }) : null;
  const risk = pr?.risk ?? pr?.overallRisk ?? meta?.risk;
  const isHighRisk = risk === "high";

  return (
    <div className="space-y-5 max-w-4xl animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,0,170,0.1)", border: "1px solid rgba(255,0,170,0.3)" }}>
            <Cpu className="w-5 h-5 text-magenta-neon" />
          </div>
          <div>
            <h1 className="font-bold text-white text-xl" style={{ fontFamily: "Orbitron,sans-serif" }}>AI CONTROL BRAIN</h1>
            <p className="font-mono text-xs text-white/40">Natural language → validated action → DB update → rollback available</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
            <Shield className="w-3.5 h-3.5 text-green-400" />
            <span className="font-mono text-[10px] text-green-400">SAFE MODE</span>
          </div>
          <button onClick={() => { setShowRollback(!showRollback); setShowHistory(false); }}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${showRollback ? "text-magenta-neon border-magenta-neon/30 bg-magenta-neon/8" : "text-white/40 border-white/10 hover:text-white"}`}>
            Rollbacks {rollbacks.length > 0 && `(${rollbacks.length})`}
          </button>
          <button onClick={() => { setShowHistory(!showHistory); setShowRollback(false); }}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${showHistory ? "text-cyan-neon border-cyan-neon/30 bg-cyan-neon/8" : "text-white/40 border-white/10 hover:text-white"}`}>
            History ({history.length})
          </button>
        </div>
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)" }}>
        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="font-mono text-[11px] text-yellow-200/60">
          Commands are parsed by Claude and presented for your review before anything executes. Every action is logged with before/after values. 24-hour rollback window.
        </p>
      </div>

      {/* Input */}
      <div className="cyber-card p-5">
        <label className="label">Command Input</label>
        <div className="flex gap-3">
          <textarea ref={ref} value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
            placeholder="Type a natural language admin command… e.g. 'Enable maintenance mode' or 'Set free tier limit to 3 jobs'"
            rows={2} disabled={parsing}
            className="textarea text-sm flex-1" />
          <button onClick={handleParse} disabled={!prompt.trim() || parsing}
            className="btn-neon-magenta px-5 rounded-xl flex-shrink-0 flex-col items-center justify-center gap-1 min-w-[80px]">
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            <span className="text-[10px]">{parsing ? "PARSING" : "PARSE"}</span>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setPrompt(ex)}
              className="font-mono text-[10px] px-2.5 py-1.5 rounded-lg border border-white/6 text-white/40 hover:text-white hover:border-white/15 transition-all">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Parse result */}
      {current && current.status !== "rejected" && pr && (
        <div className={`cyber-card p-5 animate-scale-in ${current.status === "executed" ? "border-green-500/20" : current.status === "failed" ? "border-red-500/20" : current.status === "dry_run" ? "border-blue-400/20" : pr.type === "clarification" ? "border-yellow-400/20" : pr.type === "low_confidence" ? "border-orange-400/20" : "border-yellow-400/15"}`}>

          {/* ── Clarification needed ───────────────────────────────── */}
          {pr.type === "clarification" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <span className="font-bold text-yellow-400 text-sm">Clarification Needed</span>
              </div>
              <p className="text-sm text-white/70">{pr.message}</p>
              {pr.questions && pr.questions.length > 0 && (
                <div className="space-y-2">
                  {pr.questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/80">{q}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setCurrent(null); setPrompt(current.prompt); ref.current?.focus(); }}
                  className="btn-neon text-xs px-4 py-2 rounded-lg flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5" /> Refine Command
                </button>
              </div>
            </div>
          )}

          {/* ── Low confidence ─────────────────────────────────────── */}
          {pr.type === "low_confidence" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-bold text-orange-400 text-sm">Low Confidence</span>
                <ConfidenceMeter confidence={pr.confidence ?? 0} />
              </div>
              <p className="text-sm text-white/70">{pr.message}</p>
              {pr.suggestions && (
                <ul className="space-y-1.5">
                  {pr.suggestions.map((s, i) => <li key={i} className="text-xs text-white/50 flex items-start gap-2"><span className="text-orange-400">→</span>{s}</li>)}
                </ul>
              )}
              <button onClick={() => { setCurrent(null); setPrompt(current.prompt); ref.current?.focus(); }}
                className="btn-neon text-xs px-4 py-2 rounded-lg">
                Be More Specific
              </button>
            </div>
          )}

          {/* ── Valid intent ────────────────────────────────────────── */}
          {(pr.type === "intent" || pr.type === "multi_intent") && intent && meta && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`font-mono text-xs px-3 py-1.5 rounded-lg border ${meta.color}`}>{meta.label}</span>
                  <span className={`font-mono text-[10px] px-2 py-1 rounded-lg ${RISK_BADGE[risk ?? "medium"]}`}>{(risk ?? "medium").toUpperCase()} RISK</span>
                  {pr.type === "multi_intent" && <span className="font-mono text-[10px] text-blue-400 border border-blue-400/20 bg-blue-400/10 px-2 py-1 rounded-lg">MULTI-STEP ({pr.stepCount})</span>}
                  {current.status === "executed" && <span className="flex items-center gap-1 font-mono text-xs text-green-400"><CheckCircle className="w-4 h-4" /> Executed</span>}
                  {current.status === "failed" && <span className="flex items-center gap-1 font-mono text-xs text-red-400"><XCircle className="w-4 h-4" /> Failed</span>}
                  {current.status === "dry_run" && <span className="font-mono text-xs text-blue-400">[DRY RUN]</span>}
                </div>
              </div>

              {/* Confidence */}
              <div className="mb-4">
                <div className="label mb-1.5">AI Confidence</div>
                <ConfidenceMeter confidence={intent.confidence} />
              </div>

              {/* Intent preview */}
              <div className="mb-4">
                <div className="label mb-2">Parsed Intent</div>
                <div className="rounded-xl p-4 font-mono text-xs space-y-1" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div><span className="text-cyan-neon">action:</span> <span className="text-white">{intent.action}</span></div>
                  <div><span className="text-cyan-neon">parameters:</span></div>
                  {Object.entries(intent.parameters).map(([k, v]) => (
                    <div key={k} className="ml-4"><span className="text-white/60">{k}:</span> <span className="text-yellow-400">{JSON.stringify(v)}</span></div>
                  ))}
                </div>
              </div>

              {/* Reasoning */}
              <div className="mb-4">
                <div className="label mb-1.5">AI Reasoning</div>
                <p className="text-sm text-white/70 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>{intent.reasoning}</p>
              </div>

              {/* Warnings */}
              {(pr.warnings ?? []).length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {(pr.warnings ?? []).map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)" }}>
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-yellow-200/70">{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Result */}
              {current.execResult && (
                <div className={`mb-4 p-4 rounded-xl ${current.execResult.success ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
                  <p className={`font-bold text-sm mb-2 ${current.execResult.success ? "text-green-400" : "text-red-400"}`}>
                    {current.execResult.dryRun ? "[DRY RUN] " : ""}{current.execResult.success ? "Success" : "Failed"}
                  </p>
                  <p className="text-sm text-white/80">{current.execResult.message}</p>
                  {current.execResult.before !== undefined && (
                    <div className="flex items-center gap-3 mt-3 font-mono text-xs">
                      <span className="text-white/40">Before: <span className="text-red-400">{JSON.stringify(current.execResult.before)}</span></span>
                      <ArrowRight className="w-3 h-3 text-white/30" />
                      <span className="text-white/40">After: <span className="text-green-400">{JSON.stringify(current.execResult.after)}</span></span>
                    </div>
                  )}
                  {current.execResult.rollbackAvailable && (
                    <p className="font-mono text-[10px] text-white/30 mt-2">Rollback available for 24h in the Rollbacks panel</p>
                  )}
                </div>
              )}

              {/* High risk confirmation */}
              {current.status === "pending" && isHighRisk && (
                <div className="mb-4 flex items-start gap-3 p-3.5 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <input type="checkbox" id="highRisk" checked={highRiskConfirmed} onChange={e => setHighRiskConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-red-400" />
                  <label htmlFor="highRisk" className="text-xs text-red-300/80 cursor-pointer">
                    <strong className="text-red-400">HIGH RISK ACTION:</strong> I understand this change affects system behaviour. I confirm this is intentional.
                  </label>
                </div>
              )}

              {/* Action buttons */}
              {current.status === "pending" && (
                <div className="flex flex-wrap gap-3">
                  {/* Dry run first */}
                  <button onClick={() => doExecute(true)} disabled={dryRunning || executing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono disabled:opacity-40 transition-all"
                    style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                    {dryRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {dryRunning ? "Simulating…" : "Dry Run"}
                  </button>
                  {/* Execute */}
                  <button onClick={() => doExecute(false)}
                    disabled={executing || dryRunning || (isHighRisk && !highRiskConfirmed)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display disabled:opacity-40 transition-all"
                    style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }}>
                    {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {executing ? "Executing…" : "Approve & Execute"}
                  </button>
                  <button onClick={reject} className="btn-danger text-sm px-4 py-2.5 rounded-xl">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => { setCurrent(null); setPrompt(current.prompt); }} className="btn-secondary text-xs px-3 py-2 rounded-lg">
                    <RotateCcw className="w-3.5 h-3.5" /> Re-parse
                  </button>
                </div>
              )}

              {/* Reset after terminal state */}
              {["executed","failed","dry_run"].includes(current.status) && (
                <button onClick={() => { setCurrent(null); setPrompt(""); ref.current?.focus(); }}
                  className="btn-secondary text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5" /> New Command
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Rollback panel */}
      {showRollback && (
        <div className="cyber-card p-5 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: "Orbitron,sans-serif" }}>ROLLBACK HISTORY</h2>
            <button onClick={loadRollbacks} disabled={loadingRollbacks} className="btn-icon">
              <RefreshCw className={`w-4 h-4 ${loadingRollbacks ? "animate-spin" : ""}`} />
            </button>
          </div>
          {rollbacks.length === 0 ? (
            <p className="font-mono text-xs text-white/30 text-center py-6">No rollbackable actions in the last 24 hours</p>
          ) : (
            <div className="space-y-2.5">
              {rollbacks.map(r => (
                <div key={r.sessionId} className="flex items-center justify-between p-3.5 rounded-xl border border-white/6 hover:border-white/12 transition-all">
                  <div>
                    <div className="text-sm text-white font-medium">{ACTION_META[r.action]?.label ?? r.action}</div>
                    <div className="font-mono text-[10px] text-white/40 mt-0.5">{r.resource} · Expires in {r.minutesUntilExpiry}min</div>
                    <div className="font-mono text-[10px] text-white/30">{JSON.stringify(r.snapshotBefore)} → {JSON.stringify(r.snapshotAfter)}</div>
                  </div>
                  <button onClick={() => doRollback(r.sessionId)}
                    className="btn-danger text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0">
                    <RotateCcw className="w-3 h-3" /> Rollback
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="cyber-card p-5 animate-scale-in">
          <h2 className="font-bold text-white text-sm tracking-wide mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>COMMAND HISTORY ({history.length})</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map(s => {
              const i = s.parseResult.intent ?? s.parseResult.intents?.[0];
              const m = i ? ACTION_META[i.action] : null;
              return (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <span className={`text-xs mt-0.5 font-bold ${s.status === "executed" ? "text-green-400" : s.status === "failed" ? "text-red-400" : s.status === "rejected" ? "text-white/25" : s.status === "dry_run" ? "text-blue-400" : "text-yellow-400"}`}>
                    {s.status === "executed" ? "✓" : s.status === "failed" ? "✗" : s.status === "rejected" ? "—" : s.status === "dry_run" ? "~" : "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-white truncate">{s.prompt}</div>
                    <div className="font-mono text-[10px] text-white/35">{m?.label ?? "unknown"} · {new Date(s.ts).toLocaleTimeString()}</div>
                    {s.execResult?.message && <div className={`font-mono text-[10px] mt-0.5 truncate ${s.execResult.success ? "text-green-400/60" : "text-red-400/60"}`}>{s.execResult.message}</div>}
                  </div>
                  <button onClick={() => setPrompt(s.prompt)} className="btn-icon flex-shrink-0"><RotateCcw className="w-3 h-3" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
