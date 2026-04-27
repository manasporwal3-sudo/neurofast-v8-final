// app/admin/config/page.tsx — v6 UPGRADE
// Adds: grouped configs, inline editing with validation, unsaved change count,
//       confirmation modal for dangerous changes, last-updated metadata

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Save, RefreshCw, Settings, Info, AlertTriangle, RotateCcw, Check, X } from "lucide-react";

interface ConfigRow {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  category: string;
  lastUpdatedBy: string | null;
  updatedAt: string;
}
interface GroupedConfig { [category: string]: ConfigRow[] }

const CATEGORY_META: Record<string, { label: string; desc: string; danger?: boolean }> = {
  pricing:   { label: "💰 Pricing",        desc: "Credit costs and revenue settings" },
  limits:    { label: "🔒 Limits",          desc: "Usage caps per user and plan" },
  ratelimit: { label: "⚡ Rate Limits",     desc: "API throttling per route" },
  features:  { label: "🚩 Feature Flags",   desc: "Enable or disable platform features", danger: true },
  ai:        { label: "🤖 AI Controls",     desc: "AI brain behavior and safety thresholds" },
  general:   { label: "⚙️  General",         desc: "Miscellaneous platform settings" },
};

// Known validation rules per config key
const VALIDATION: Record<string, { min?: number; max?: number; label: string }> = {
  "pricing.inference_cost_per_msg":  { min: 1,   max: 10,     label: "1–10 credits" },
  "pricing.free_signup_credits":     { min: 10,  max: 1000,   label: "10–1000 credits" },
  "limits.monthly_jobs_free":        { min: 1,   max: 100,    label: "1–100 jobs" },
  "limits.monthly_jobs_paid":        { min: 1,   max: 500,    label: "1–500 jobs" },
  "ratelimit.chat_per_min":          { min: 5,   max: 200,    label: "5–200 req/min" },
  "ratelimit.train_per_min":         { min: 1,   max: 20,     label: "1–20 req/min" },
};

function validate(key: string, value: unknown): string | null {
  const rule = VALIDATION[key];
  if (!rule || typeof value !== "number") return null;
  if (rule.min !== undefined && value < rule.min) return `Min: ${rule.min} (${rule.label})`;
  if (rule.max !== undefined && value > rule.max) return `Max: ${rule.max} (${rule.label})`;
  return null;
}

function ConfirmModal({
  count, onConfirm, onCancel,
}: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="cyber-card p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <h3 className="font-display text-base font-bold text-white">Save {count} config change{count > 1 ? "s" : ""}?</h3>
        </div>
        <p className="font-body text-sm text-muted-foreground mb-6">
          Config changes take effect within 5 minutes. Feature flag changes (e.g. maintenance mode) are immediate. All changes are audited.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded border border-white/10 text-white/60 text-sm font-mono hover:bg-white/5 transition-all">
            CANCEL
          </button>
          <button onClick={onConfirm} className="flex-1 btn-neon py-2 rounded text-sm font-display font-bold">
            SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminConfigPage() {
  const [grouped, setGrouped] = useState<GroupedConfig>({});
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      const data = await res.json() as { grouped: GroupedConfig };
      setGrouped(data.grouped);
      setEdits({});
      setErrors({});
    } catch {
      toast.error("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleEdit = (key: string, rawValue: string, originalValue: unknown) => {
    let parsed: unknown = rawValue;
    if (typeof originalValue === "boolean") parsed = rawValue === "true";
    else if (typeof originalValue === "number") parsed = parseFloat(rawValue);

    setEdits((prev) => ({ ...prev, [key]: parsed }));

    // Live validation
    const err = validate(key, parsed);
    setErrors((prev) => {
      if (err) return { ...prev, [key]: err };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getDirty = () => Object.keys(edits);
  const hasErrors = () => Object.keys(errors).length > 0;

  const handleSave = async () => {
    if (getDirty().length === 0) { toast.info("No changes to save."); return; }
    if (hasErrors()) { toast.error("Fix validation errors before saving."); return; }
    setShowConfirm(true);
  };

  const executeSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    const dirty = getDirty();
    try {
      const updates = dirty.map((key) => ({ key, value: edits[key] }));
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json() as { results: Array<{ key: string; success: boolean }> };
      const failed = data.results.filter((r) => !r.success);
      if (failed.length > 0) {
        toast.error(`${failed.length} config(s) failed to save.`);
      } else {
        toast.success(`✅ ${dirty.length} config(s) saved.`);
        setSavedKeys(new Set(dirty));
        setTimeout(() => setSavedKeys(new Set()), 2000);
        setEdits({});
        await fetchConfig();
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetKey = (key: string) => {
    setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const getDisplayValue = (key: string, originalValue: unknown) =>
    key in edits ? String(edits[key]) : String(originalValue);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 text-cyan-neon animate-spin mr-3" />
      <span className="font-mono text-cyan-neon text-sm">LOADING CONFIG...</span>
    </div>
  );

  const dirtyCount = getDirty().length;
  const errorCount = Object.keys(errors).length;

  return (
    <>
      {showConfirm && <ConfirmModal count={dirtyCount} onConfirm={executeSave} onCancel={() => setShowConfirm(false)} />}

      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-cyan-neon" />
            <div>
              <h1 className="font-display text-xl font-bold text-white">SYSTEM CONFIG</h1>
              <p className="font-mono text-xs text-muted-foreground">Changes cached 5 min · All edits audited</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {dirtyCount > 0 && (
              <span className="font-mono text-xs px-2.5 py-1 rounded border border-yellow-400/30 bg-yellow-400/10 text-yellow-400">
                {dirtyCount} unsaved
              </span>
            )}
            {errorCount > 0 && (
              <span className="font-mono text-xs px-2.5 py-1 rounded border border-red-400/30 bg-red-400/10 text-red-400">
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </span>
            )}
            <button onClick={fetchConfig} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm transition-colors disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={handleSave} disabled={saving || dirtyCount === 0 || errorCount > 0}
              className="btn-neon px-5 py-2 rounded flex items-center gap-2 text-sm font-display disabled:opacity-40 transition-all active:scale-95">
              <Save className="w-4 h-4" />
              {saving ? "SAVING..." : `SAVE${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        </div>

        {/* Config sections */}
        {Object.entries(grouped).map(([category, configs]) => {
          const meta = CATEGORY_META[category];
          const categoryDirty = configs.filter((c) => c.key in edits).length;

          return (
            <div key={category} className="cyber-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 bg-void-400 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-bold text-white tracking-wider flex items-center gap-2">
                    {meta?.label ?? category.toUpperCase()}
                    {categoryDirty > 0 && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                        {categoryDirty} MODIFIED
                      </span>
                    )}
                    {meta?.danger && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">
                        HIGH IMPACT
                      </span>
                    )}
                  </h2>
                  {meta?.desc && <p className="font-body text-xs text-muted-foreground mt-0.5">{meta.desc}</p>}
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {configs.map((config) => {
                  const isDirty = config.key in edits;
                  const err = errors[config.key];
                  const justSaved = savedKeys.has(config.key);
                  const rule = VALIDATION[config.key];

                  return (
                    <div key={config.key}
                      className={`flex items-start gap-4 px-5 py-4 transition-colors ${isDirty ? "bg-yellow-400/3" : ""}`}>
                      {/* Key + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-cyan-neon">{config.key}</span>
                          {isDirty && !err && (
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                              MODIFIED
                            </span>
                          )}
                          {err && (
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> {err}
                            </span>
                          )}
                          {justSaved && (
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-400/20 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> SAVED
                            </span>
                          )}
                        </div>
                        {config.description && (
                          <p className="font-body text-xs text-muted-foreground mt-1">{config.description}</p>
                        )}
                        {rule && (
                          <p className="font-mono text-[10px] text-white/20 mt-0.5">Range: {rule.label}</p>
                        )}
                        {config.lastUpdatedBy && (
                          <p className="font-mono text-[10px] text-white/20 mt-0.5">
                            Last: {config.lastUpdatedBy} · {new Date(config.updatedAt).toLocaleDateString("en-IN")}
                          </p>
                        )}
                      </div>

                      {/* Value editor + reset */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {typeof config.value === "boolean" ? (
                          <select
                            value={getDisplayValue(config.key, config.value)}
                            onChange={(e) => handleEdit(config.key, e.target.value, config.value)}
                            className={`w-28 bg-void-500 border rounded px-2 py-1.5 font-mono text-xs text-white focus:outline-none transition-colors ${
                              isDirty ? "border-yellow-400/40 focus:border-yellow-400/60" : "border-white/10 focus:border-cyan-neon/40"
                            }`}
                          >
                            <option value="true">✓ true</option>
                            <option value="false">✗ false</option>
                          </select>
                        ) : (
                          <input
                            type={typeof config.value === "number" ? "number" : "text"}
                            value={getDisplayValue(config.key, config.value)}
                            onChange={(e) => handleEdit(config.key, e.target.value, config.value)}
                            step={typeof config.value === "number" ? "any" : undefined}
                            className={`w-32 bg-void-500 border rounded px-2 py-1.5 font-mono text-xs text-white focus:outline-none transition-colors ${
                              err ? "border-red-400/50 focus:border-red-400/70" :
                              isDirty ? "border-yellow-400/40 focus:border-yellow-400/60" :
                              "border-white/10 focus:border-cyan-neon/40"
                            }`}
                          />
                        )}
                        {isDirty && (
                          <button onClick={() => resetKey(config.key)}
                            className="p-1.5 rounded border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-all"
                            title="Reset to original">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded border border-cyan-neon/10 bg-cyan-neon/5">
          <Info className="w-4 h-4 text-cyan-neon flex-shrink-0 mt-0.5" />
          <p className="font-body text-xs text-muted-foreground">
            Config changes cache for 5 minutes. Feature flags (maintenance, registration) take effect immediately.
            All changes are audited in <span className="font-mono text-white">audit_logs</span>.
            The AI Control Brain can propose changes — they require admin approval before executing.
          </p>
        </div>
      </div>
    </>
  );
}
