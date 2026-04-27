// components/models/ModelEditor.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FineTunedModel } from "@/lib/db/schema";
import { Save, Upload, Shield, Merge, MessageSquare } from "lucide-react";
import Link from "next/link";

interface Props { model: FineTunedModel; }

const TABS = [
  { id: "system", label: "System Prompt", icon: MessageSquare },
  { id: "dpo", label: "Preference Data", icon: Upload },
  { id: "safety", label: "Safety Filters", icon: Shield },
  { id: "merge", label: "Merge Adapters", icon: Merge },
];

export default function ModelEditor({ model }: Props) {
  const [tab, setTab] = useState("system");
  const [systemPrompt, setSystemPrompt] = useState(model.systemPrompt ?? "");
  const [safetyEnabled, setSafetyEnabled] = useState(model.safetyFiltersEnabled);
  const [saving, setSaving] = useState(false);
  const [dpoFile, setDpoFile] = useState<File | null>(null);

  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, safetyFiltersEnabled: safetyEnabled }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Model updated!");
    } catch {
      toast.error("We couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Editor panel */}
      <div className="lg:col-span-2 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-void-400 rounded-lg">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-mono transition-all flex-1 justify-center ${
                  tab === t.id
                    ? "bg-cyan-neon/10 border border-cyan-neon/30 text-cyan-neon"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="cyber-card p-5">
          {tab === "system" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold text-white mb-1">SYSTEM PROMPT EDITOR</h3>
                <p className="font-body text-xs text-muted-foreground">
                  Define how your model behaves. This is injected as the system message in every conversation.
                </p>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={12}
                className="w-full bg-void-400 border border-white/10 rounded px-4 py-3 font-mono text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-neon/40 resize-none leading-relaxed"
                placeholder="You are NeuroFast AI, specialized in logistics operations..."
              />
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-muted-foreground">{systemPrompt.length} chars</span>
                <button
                  onClick={handleSaveSystem}
                  disabled={saving}
                  className="btn-neon px-5 py-2 rounded flex items-center gap-2 text-sm font-display disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "SAVING..." : "SAVE PROMPT"}
                </button>
              </div>
            </div>
          )}

          {tab === "dpo" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold text-white mb-1">PREFERENCE DATA (DPO)</h3>
                <p className="font-body text-xs text-muted-foreground">
                  Upload chosen/rejected response pairs to fine-tune model behavior via Direct Preference Optimization.
                </p>
              </div>

              <div className="bg-void-400 border border-white/5 rounded p-4">
                <h4 className="font-mono text-xs text-cyan-neon mb-2">Expected CSV Format:</h4>
                <pre className="font-mono text-xs text-muted-foreground">
{`prompt,chosen,rejected
"Route query...", "Optimal route...", "Generic answer..."`}
                </pre>
              </div>

              <label className="flex flex-col items-center justify-center h-28 rounded border-2 border-dashed border-white/10 cursor-pointer hover:border-cyan-neon/30 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="font-body text-sm text-muted-foreground">
                  {dpoFile ? dpoFile.name : "Upload preference pairs CSV"}
                </span>
                <input type="file" accept=".csv,.jsonl" className="hidden" onChange={(e) => setDpoFile(e.target.files?.[0] ?? null)} />
              </label>

              <button
                disabled={!dpoFile}
                className="btn-neon px-5 py-2 rounded text-sm font-display disabled:opacity-40"
                onClick={() => toast.info("DPO upload: Upload file, then re-train model to apply preferences.")}
              >
                UPLOAD & QUEUE RE-TRAIN
              </button>
            </div>
          )}

          {tab === "safety" && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-sm font-bold text-white mb-1">SAFETY FILTERS</h3>
                <p className="font-body text-xs text-muted-foreground">
                  Configure content moderation and safety guardrails for your model.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: "main", label: "Content Safety Filter", desc: "Block harmful, dangerous, or inappropriate responses", enabled: safetyEnabled },
                  { id: "logistics", label: "Logistics Context Lock", desc: "Keep responses focused on logistics domain only", enabled: true },
                  { id: "pii", label: "PII Detection", desc: "Warn when sensitive personal data is in prompts", enabled: true },
                ].map((filter) => (
                  <div key={filter.id} className="flex items-start justify-between p-4 rounded bg-void-400 border border-white/5">
                    <div>
                      <div className="font-body text-sm text-white font-medium mb-0.5">{filter.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{filter.desc}</div>
                    </div>
                    <button
                      onClick={() => filter.id === "main" && setSafetyEnabled(!safetyEnabled)}
                      className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${
                        filter.enabled ? "bg-cyan-neon/30 border border-cyan-neon/50" : "bg-void-500 border border-white/10"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${
                        filter.enabled ? "translate-x-5 bg-cyan-neon" : "translate-x-0.5 bg-white/20"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={handleSaveSystem} className="btn-neon px-5 py-2 rounded text-sm font-display flex items-center gap-2">
                <Save className="w-4 h-4" /> SAVE FILTERS
              </button>
            </div>
          )}

          {tab === "merge" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold text-white mb-1">MERGE ADAPTERS</h3>
                <p className="font-body text-xs text-muted-foreground">
                  Merge your LoRA adapter into the base model for faster inference and simplified deployment.
                </p>
              </div>
              <div className="p-8 rounded border border-dashed border-white/10 text-center">
                <Merge className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <h4 className="font-display text-sm font-bold text-white mb-2">COMING SOON</h4>
                <p className="font-body text-xs text-muted-foreground">
                  One-click adapter merge + quantization (GGUF, GPTQ) will be available in the next release.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side panel — model info */}
      <div className="space-y-4">
        <div className="cyber-card p-4">
          <h3 className="font-mono text-xs text-cyan-neon uppercase tracking-wider mb-3">MODEL INFO</h3>
          <div className="space-y-2.5">
            {[
              { label: "Name", value: model.name },
              { label: "Base", value: model.baseModel.split("/")[1] },
              { label: "Status", value: model.status },
              { label: "Total Chats", value: String(model.totalChats) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">{label}</span>
                <span className="font-mono text-xs text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cyber-card p-4">
          <h3 className="font-mono text-xs text-cyan-neon uppercase tracking-wider mb-3">QUICK ACTIONS</h3>
          <div className="space-y-2">
            <Link
              href={`/playground/${model.id}`}
              className="w-full btn-neon px-4 py-2 rounded text-sm font-display flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" /> OPEN PLAYGROUND
            </Link>
            <button
              onClick={() => {
                const url = `${window.location.origin}/playground/${model.shareId ?? model.id}`;
                navigator.clipboard.writeText(url);
                toast.success("Share link copied!");
              }}
              className="w-full px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm font-body transition-colors"
            >
              Copy Share Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
