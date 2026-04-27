// components/training/TrainStepper.tsx
"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User } from "@/lib/db/schema";
import { SUPPORTED_MODELS } from "@/lib/training";
import { LOGISTICS_TEMPLATES, estimateTrainingCost } from "@/lib/training-utils";
import { Upload, ChevronRight, ChevronLeft, Zap, CheckCircle, AlertTriangle } from "lucide-react";
import { formatCredits } from "@/lib/utils";

interface StepProps {
  user: User;
}

interface TrainConfig {
  datasetId: string;
  datasetName: string;
  rowCount: number;
  templateId: string | null;
  baseModel: string;
  modelSuffix: string;
  epochs: number;
  learningRate: number;
  loraRank: number;
  warmupRatio: number;
  batchSize: number;
}

const DEFAULT_CONFIG: TrainConfig = {
  datasetId: "",
  datasetName: "",
  rowCount: 0,
  templateId: null,
  baseModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  modelSuffix: "",
  epochs: 3,
  learningRate: 0.00002,
  loraRank: 8,
  warmupRatio: 0.1,
  batchSize: 4,
};

const STEPS = ["Dataset", "Base Model", "Config", "Review & Launch"];

export default function TrainStepper({ user }: StepProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTemplate = searchParams.get("template");

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<TrainConfig>({
    ...DEFAULT_CONFIG,
    templateId: initialTemplate,
  });
  const [uploading, setUploading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchedJobId, setLaunchedJobId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const estimate = estimateTrainingCost({
    baseModel: config.baseModel,
    rowCount: config.rowCount || 100,
    epochs: config.epochs,
  });

  const canAfford = user.creditsBalance >= estimate.creditsRequired;

  // ── Step 1: Upload / Template ──────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError(null);
    const suffix = file.name.replace(/\.[^.]+$/, "").slice(0, 30).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    setConfig((c) => ({ ...c, modelSuffix: `neurofast-${suffix}-v1`, datasetName: file.name }));
  };

  const handleUpload = async () => {
    if (!uploadFile && !config.templateId) {
      toast.error("Please upload your dataset file or select a template to continue.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      if (uploadFile) fd.append("file", uploadFile);
      if (config.templateId) fd.append("templateId", config.templateId);

      const res = await fetch("/api/datasets/upload", { method: "POST", body: fd });
      const data = await res.json() as { datasetId?: string; rowCount?: number; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setConfig((c) => ({
        ...c,
        datasetId: data.datasetId!,
        rowCount: data.rowCount!,
        modelSuffix:
          c.modelSuffix ||
          `neurofast-${config.templateId ?? "custom"}-v1`,
      }));
      toast.success(`Dataset uploaded: ${data.rowCount} examples`);
      setStep(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // ── Step 4: Launch ─────────────────────────────────────────────────────────
  const handleLaunch = async () => {
    if (!config.datasetId || !config.baseModel || !config.modelSuffix) {
      toast.error("Please fill in all required fields before launching training.");
      return;
    }
    setLaunching(true);
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: config.datasetId,
          baseModel: config.baseModel,
          modelSuffix: config.modelSuffix,
          epochs: config.epochs,
          learningRate: config.learningRate,
          loraRank: config.loraRank,
          warmupRatio: config.warmupRatio,
          batchSize: config.batchSize,
        }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Launch failed");
      setLaunchedJobId(data.jobId!);
      toast.success("Training job launched!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Launch failed";
      toast.error(msg);
    } finally {
      setLaunching(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (launchedJobId) {
    return (
      <div className="cyber-card p-10 text-center animate-bounce-in">
        <div className="w-20 h-20 rounded-2xl bg-green-400/10 border border-green-400/25 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">TRAINING LAUNCHED!</h2>
        <p className="font-body text-muted-foreground mb-2">
          Job ID: <span className="font-mono text-cyan-neon">{launchedJobId}</span>
        </p>
        <p className="font-body text-muted-foreground mb-8">
          Your model is training. Check live status in My Models.
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={() => router.push("/models")} className="btn-neon px-6 py-2.5 rounded font-display text-sm">
            VIEW MY MODELS →
          </button>
          <button onClick={() => { setLaunchedJobId(null); setConfig(DEFAULT_CONFIG); setStep(0); }}
            className="px-6 py-2.5 rounded border border-white/10 text-white/70 hover:text-white text-sm font-body">
            Train Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold border transition-all ${
                  i < step
                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : i === step
                    ? "bg-cyan-neon/20 border-cyan-neon/60 text-cyan-neon shadow-neon-sm"
                    : "border-white/10 text-white/20"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`font-mono text-xs hidden sm:block ${
                  i === step ? "text-cyan-neon" : i < step ? "text-green-400" : "text-white/20"
                }`}
              >
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${i < step ? "bg-green-500/30" : "bg-white/5"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="cyber-card p-6">
        {/* STEP 0: Dataset */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white mb-1">UPLOAD DATASET OR CHOOSE TEMPLATE</h2>
              <p className="font-body text-muted-foreground text-sm">
                Upload a JSONL/CSV file or use a pre-built logistics template.
              </p>
            </div>

            {/* Templates */}
            <div>
              <h3 className="font-mono text-xs text-cyan-neon uppercase tracking-wider mb-3">Logistics Templates</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {LOGISTICS_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setConfig((c) => ({ ...c, templateId: t.id, modelSuffix: `neurofast-${t.id}-v1`, datasetName: t.name }))}
                    className={`p-4 rounded border text-left transition-all ${
                      config.templateId === t.id
                        ? "border-cyan-neon/50 bg-cyan-neon/10"
                        : "border-white/5 bg-void-400 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{t.icon}</span>
                      <span className="font-display text-xs font-bold text-white">{t.name}</span>
                    </div>
                    <p className="font-body text-xs text-muted-foreground">{t.description}</p>
                    <div className="mt-2 font-mono text-[10px] text-cyan-neon/60">
                      ~{t.estimatedRows} examples • {t.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="font-mono text-xs text-muted-foreground">OR UPLOAD CUSTOM DATA</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {/* File upload */}
            <div>
              <label
                htmlFor="dataset-upload"
                className={`flex flex-col items-center justify-center w-full h-36 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
                  uploadFile
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-white/10 bg-void-400 hover:border-cyan-neon/30 hover:bg-cyan-neon/5"
                }`}
              >
                <Upload className={`w-8 h-8 mb-2 ${uploadFile ? "text-green-400" : "text-muted-foreground"}`} />
                {uploadFile ? (
                  <span className="font-mono text-sm text-green-400">{uploadFile.name}</span>
                ) : (
                  <>
                    <span className="font-body text-sm text-muted-foreground">Drop JSONL or CSV here</span>
                    <span className="font-mono text-xs text-white/20 mt-1">Max 50MB · Auto-converts to Together format</span>
                  </>
                )}
                <input id="dataset-upload" type="file" accept=".jsonl,.csv,.txt" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-red-400 text-sm font-mono">
                <AlertTriangle className="w-4 h-4" />
                {uploadError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={uploading || (!uploadFile && !config.templateId)}
                className="btn-neon px-6 py-2.5 rounded flex items-center gap-2 text-sm font-display disabled:opacity-40"
              >
                {uploading ? "PROCESSING..." : "NEXT: SELECT MODEL"}
                {!uploading && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Base Model */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white mb-1">SELECT BASE MODEL</h2>
              <p className="font-body text-muted-foreground text-sm">
                Choose the foundation model to fine-tune. Larger models = more capability + higher cost.
              </p>
            </div>

            <div className="space-y-3">
              {SUPPORTED_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setConfig((c) => ({ ...c, baseModel: m.id }))}
                  className={`w-full p-4 rounded border text-left transition-all ${
                    config.baseModel === m.id
                      ? "border-cyan-neon/50 bg-cyan-neon/10"
                      : "border-white/5 bg-void-400 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-white">{m.name}</span>
                      {m.recommended && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-neon/20 text-cyan-neon border border-cyan-neon/30">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      ${m.costPerMToken}/M tokens
                    </span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground">{m.description}</p>
                  <div className="flex gap-4 mt-2 font-mono text-[10px] text-white/30">
                    <span>{m.paramCount} params</span>
                    <span>{m.maxContextLength.toLocaleString()} ctx</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm font-body">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(2)} className="btn-neon px-6 py-2.5 rounded flex items-center gap-2 text-sm font-display">
                NEXT: CONFIGURE <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Training Config */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white mb-1">TRAINING CONFIGURATION</h2>
              <p className="font-body text-muted-foreground text-sm">
                Fine-tune hyperparameters. Defaults work well for most logistics tasks.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Model suffix */}
              <div className="md:col-span-2">
                <label className="font-mono text-xs text-cyan-neon uppercase tracking-wider block mb-2">Model Name / Suffix *</label>
                <input
                  type="text"
                  value={config.modelSuffix}
                  onChange={(e) => setConfig((c) => ({ ...c, modelSuffix: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                  className="w-full bg-void-400 border border-white/10 rounded px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-cyan-neon/40"
                  placeholder="neurofast-fleet-v1"
                />
                <p className="font-mono text-[10px] text-muted-foreground mt-1">Lowercase, hyphens only. Max 30 chars.</p>
              </div>

              {/* Epochs */}
              <div>
                <label className="font-mono text-xs text-cyan-neon uppercase tracking-wider block mb-2">
                  Epochs: <span className="text-white">{config.epochs}</span>
                </label>
                <input
                  type="range" min={1} max={10} value={config.epochs}
                  onChange={(e) => setConfig((c) => ({ ...c, epochs: +e.target.value }))}
                  className="w-full accent-cyan-neon"
                />
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                  <span>1 (fast)</span><span>5 (balanced)</span><span>10 (thorough)</span>
                </div>
              </div>

              {/* LoRA rank */}
              <div>
                <label className="font-mono text-xs text-cyan-neon uppercase tracking-wider block mb-2">
                  LoRA Rank: <span className="text-white">{config.loraRank}</span>
                </label>
                <input
                  type="range" min={4} max={64} step={4} value={config.loraRank}
                  onChange={(e) => setConfig((c) => ({ ...c, loraRank: +e.target.value }))}
                  className="w-full accent-cyan-neon"
                />
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                  <span>4 (small)</span><span>8 (default)</span><span>64 (max)</span>
                </div>
              </div>

              {/* Learning rate */}
              <div>
                <label className="font-mono text-xs text-cyan-neon uppercase tracking-wider block mb-2">Learning Rate</label>
                <select
                  value={config.learningRate}
                  onChange={(e) => setConfig((c) => ({ ...c, learningRate: +e.target.value }))}
                  className="w-full bg-void-400 border border-white/10 rounded px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-cyan-neon/40"
                >
                  <option value={0.00001}>1e-5 (conservative)</option>
                  <option value={0.00002}>2e-5 (default)</option>
                  <option value={0.00005}>5e-5 (aggressive)</option>
                  <option value={0.0001}>1e-4 (experimental)</option>
                </select>
              </div>

              {/* Batch size */}
              <div>
                <label className="font-mono text-xs text-cyan-neon uppercase tracking-wider block mb-2">Batch Size</label>
                <select
                  value={config.batchSize}
                  onChange={(e) => setConfig((c) => ({ ...c, batchSize: +e.target.value }))}
                  className="w-full bg-void-400 border border-white/10 rounded px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-cyan-neon/40"
                >
                  <option value={2}>2 (memory efficient)</option>
                  <option value={4}>4 (default)</option>
                  <option value={8}>8 (faster)</option>
                  <option value={16}>16 (high memory)</option>
                </select>
              </div>
            </div>

            {/* Cost preview */}
            <div className="bg-void-400 border border-cyan-neon/10 rounded-lg p-4">
              <h3 className="font-mono text-xs text-cyan-neon uppercase tracking-wider mb-3">COST ESTIMATE</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="font-display text-lg font-bold text-white">{estimate.totalTokens.toLocaleString()}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">TOTAL TOKENS</div>
                </div>
                <div>
                  <div className="font-display text-lg font-bold text-cyan-neon">{estimate.creditsRequired}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">CREDITS REQUIRED</div>
                </div>
                <div>
                  <div className="font-display text-lg font-bold text-white">${estimate.totalCost.toFixed(4)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">USD COST</div>
                </div>
              </div>
              <div className={`mt-3 text-center font-mono text-xs ${canAfford ? "text-green-400" : "text-red-400"}`}>
                {canAfford
                  ? `✓ You have ${formatCredits(user.creditsBalance)} credits — sufficient`
                  : `✗ Insufficient credits. Need ${estimate.creditsRequired}, have ${user.creditsBalance}. Top up in Billing.`}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm font-body">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(3)} disabled={!config.modelSuffix} className="btn-neon px-6 py-2.5 rounded flex items-center gap-2 text-sm font-display disabled:opacity-40">
                NEXT: REVIEW <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Launch */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white mb-1">REVIEW & LAUNCH</h2>
              <p className="font-body text-muted-foreground text-sm">
                Confirm your training configuration before launching.
              </p>
            </div>

            <div className="bg-void-400 rounded-lg border border-white/5 divide-y divide-white/5">
              {[
                { label: "Dataset", value: config.datasetName || "Template dataset" },
                { label: "Training Examples", value: config.rowCount.toLocaleString() },
                { label: "Base Model", value: config.baseModel.split("/")[1] },
                { label: "Model Name", value: config.modelSuffix },
                { label: "Epochs", value: config.epochs },
                { label: "LoRA Rank", value: config.loraRank },
                { label: "Learning Rate", value: config.learningRate },
                { label: "Estimated Cost", value: `${estimate.creditsRequired} credits ($${estimate.totalCost.toFixed(4)})` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
                  <span className="font-mono text-sm text-white">{String(value)}</span>
                </div>
              ))}
            </div>

            {!canAfford && (
              <div className="flex items-center gap-2 p-4 rounded border border-red-500/20 bg-red-500/5 text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-body text-sm">
                  Insufficient credits.{" "}
                  <a href="/billing" className="underline text-red-300">Top up in Billing →</a>
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm font-body">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching || !canAfford}
                className="btn-neon px-8 py-2.5 rounded flex items-center gap-2 text-sm font-display disabled:opacity-40"
              >
                <Zap className="w-4 h-4" />
                {launching ? "LAUNCHING..." : "LAUNCH TRAINING"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
