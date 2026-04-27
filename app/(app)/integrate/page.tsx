// app/(app)/integrate/page.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Download, Zap, CheckCircle, AlertTriangle, Database } from "lucide-react";
import Link from "next/link";

interface IntegrationResult {
  storeId: string;
  skuCount: number;
  fleetVehicles: number;
  incidents: number;
  generatedExamples: number;
  jsonl: string;
  message: string;
}

export default function IntegratePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntegrationResult | null>(null);
  const [uploadingToTrain, setUploadingToTrain] = useState(false);
  const [datasetId, setDatasetId] = useState<string | null>(null);

  const pullData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrate/neurofast");
      const data = await res.json() as IntegrationResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to pull data");
      setResult(data);
      toast.success(`✅ Pulled ${data.generatedExamples} training examples from NeuroFast!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Integration failed");
    } finally {
      setLoading(false);
    }
  };

  const uploadForTraining = async () => {
    if (!result) return;
    setUploadingToTrain(true);
    try {
      const blob = new Blob([result.jsonl], { type: "application/x-jsonlines" });
      const file = new File([blob], "neurofast-store-data.jsonl");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/datasets/upload", { method: "POST", body: fd });
      const data = await res.json() as { datasetId?: string; rowCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setDatasetId(data.datasetId!);
      toast.success(`Dataset saved! ${data.rowCount} examples ready for training.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingToTrain(false);
    }
  };

  const downloadJsonl = () => {
    if (!result) return;
    const blob = new Blob([result.jsonl], { type: "application/x-jsonlines" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurofast-training-${Date.now()}.jsonl`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          NEUROFAST <span className="text-cyan-neon">INTEGRATION</span>
        </h1>
        <p className="font-body text-muted-foreground mt-1">
          Pull your dark-store operational data and convert it into AI training data instantly.
        </p>
      </div>

      {/* Integration card */}
      <div className="cyber-card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded border border-cyan-neon/30 bg-cyan-neon/10 flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6 text-cyan-neon" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white mb-1">NeuroFast Dark Store Platform</h2>
            <p className="font-body text-sm text-muted-foreground">
              Connect to your existing NeuroFast store to auto-generate training data from your SKU logs, fleet performance, and operational incidents.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground bg-void-400 px-2 py-1 rounded">
                neurofast.vercel.app
              </span>
              <span className="status-running text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-neon animate-pulse" />
                SAMPLE DATA AVAILABLE
              </span>
            </div>
          </div>
        </div>

        {/* Notice about real integration */}
        <div className="flex items-start gap-2 p-3 rounded bg-yellow-500/5 border border-yellow-500/15 mb-6">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="font-body text-xs text-yellow-200/70">
            <strong className="text-yellow-400">Developer Note:</strong> This currently uses sample logistics data for demonstration.
            Add your real NeuroFast API credentials in <code className="font-mono bg-void-400 px-1 rounded">NEUROFAST_API_KEY</code> env variable
            and update the fetch URL in <code className="font-mono bg-void-400 px-1 rounded">/api/integrate/neurofast/route.ts</code>.
          </p>
        </div>

        <button
          onClick={pullData}
          disabled={loading}
          className="btn-neon px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-display disabled:opacity-40"
        >
          <Link2 className="w-4 h-4" />
          {loading ? (
                  <><span className="btn-spinner" />PULLING DATA...</>
                ) : "PULL DATA FROM NEUROFAST →"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-fade-up">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Store ID", value: result.storeId },
              { label: "SKUs Analyzed", value: result.skuCount },
              { label: "Fleet Vehicles", value: result.fleetVehicles },
              { label: "Training Examples", value: result.generatedExamples },
            ].map(({ label, value }) => (
              <div key={label} className="cyber-card p-4 text-center">
                <div className="font-display text-2xl font-bold text-cyan-neon">{value}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Success message */}
          <div className="flex items-center gap-3 p-4 rounded border border-green-500/20 bg-green-500/5">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="font-body text-sm text-green-300">{result.message}</p>
          </div>

          {/* Actions */}
          <div className="cyber-card p-5">
            <h3 className="font-display text-sm font-bold text-white mb-4">WHAT DO YOU WANT TO DO?</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <button
                onClick={uploadForTraining}
                disabled={uploadingToTrain || !!datasetId}
                className="p-4 rounded border border-cyan-neon/20 bg-cyan-neon/5 hover:bg-cyan-neon/10 transition-all text-left"
              >
                <Zap className="w-5 h-5 text-cyan-neon mb-2" />
                <div className="font-display text-xs font-bold text-white mb-1">
                  {datasetId ? "✅ SAVED TO DATASETS" : uploadingToTrain ? (
                      <><span className="btn-spinner" />SAVING...</>
                    ) : "SAVE & TRAIN"}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Upload to your datasets and start training a model
                </p>
              </button>

              <button
                onClick={downloadJsonl}
                className="p-4 rounded border border-white/5 bg-void-400 hover:bg-void-300 transition-all text-left"
              >
                <Download className="w-5 h-5 text-muted-foreground mb-2" />
                <div className="font-display text-xs font-bold text-white mb-1">DOWNLOAD JSONL</div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Download the raw training dataset file
                </p>
              </button>

              {datasetId && (
                <Link
                  href={`/train?datasetId=${datasetId}`}
                  className="p-4 rounded border border-magenta-neon/20 bg-magenta-neon/5 hover:bg-magenta-neon/10 transition-all"
                >
                  <Zap className="w-5 h-5 text-magenta-neon mb-2" />
                  <div className="font-display text-xs font-bold text-white mb-1">TRAIN NOW →</div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Jump straight to training with this dataset
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="cyber-card p-6">
        <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">HOW INTEGRATION WORKS</h2>
        <div className="space-y-4">
          {[
            { step: "01", title: "Pull Store Data", desc: "NeuroFast API exports your SKU velocity, fleet routes, and incident logs" },
            { step: "02", title: "Auto-Convert", desc: "Our engine converts operational data into structured Q&A training pairs" },
            { step: "03", title: "Fine-Tune", desc: "Train a custom AI model that understands YOUR specific store's patterns" },
            { step: "04", title: "Deploy", desc: "Use the model as your intelligent ops advisor — knows your store by heart" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-4">
              <span className="font-display text-lg font-bold text-cyan-neon/30 w-8 flex-shrink-0">{step}</span>
              <div>
                <div className="font-display text-xs font-bold text-white mb-0.5">{title}</div>
                <p className="font-body text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
