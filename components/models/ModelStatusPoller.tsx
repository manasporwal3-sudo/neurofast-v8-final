// components/models/ModelStatusPoller.tsx
// Real-time training job status with polling, cancel button, terminal logs
//
// CHANGES v5 (PART 4 — POLLING OPTIMIZATION):
//   - First 3 polls: every 5 seconds (fast feedback on job start)
//   - Next polls: every 15 seconds (reduces server load)
//   - After 20 total polls with no terminal state: stop polling automatically
//   - Error backoff: 3 consecutive errors → slow to 20s → 5 errors → stop
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { TrainingJob } from "@/lib/db/schema";
import { statusClass } from "@/lib/utils";
import { Loader2, XCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Props {
  job: TrainingJob;
}

// v5: Adaptive polling configuration
const POLL_FAST_MS = 5_000;   // first 3 attempts
const POLL_SLOW_MS = 15_000;  // subsequent attempts
const POLL_ERROR_MS = 20_000; // after 3+ consecutive errors
const POLL_FAST_COUNT = 3;    // how many fast polls before switching to slow
const POLL_MAX_TOTAL = 20;    // stop polling entirely after this many attempts
const POLL_MAX_ERRORS = 5;    // stop after this many consecutive errors

export default function ModelStatusPoller({ job: initialJob }: Props) {
  const [job, setJob] = useState(initialJob);
  const [logs, setLogs] = useState<string[]>(
    Array.isArray(initialJob.logs) ? (initialJob.logs as string[]) : []
  );
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pollErrors, setPollErrors] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [pollingStopped, setPollingStopped] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTerminal = ["completed", "failed", "cancelled"].includes(job.status);
  const isActive = !isTerminal;

  // Auto-scroll logs to bottom when expanded
  useEffect(() => {
    if (logsExpanded) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logsExpanded]);

  const poll = useCallback(async () => {
    if (!job.togetherJobId || isTerminal) return;

    try {
      const res = await fetch(`/api/jobs/${job.togetherJobId}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        setPollErrors((n) => n + 1);
        return;
      }

      const data = await res.json() as Partial<TrainingJob> & { logs?: string[] };
      setPollErrors(0);
      setPollCount((n) => n + 1);

      setJob((prev) => ({ ...prev, ...data }));
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs as string[]);
      }

      if (data.status === "completed" && initialJob.status !== "completed") {
        toast.success(`✅ Model "${initialJob.modelSuffix}" training complete!`);
      }
      if (data.status === "failed" && initialJob.status !== "failed") {
        toast.error(`Training failed for "${initialJob.modelSuffix}"`);
      }
    } catch {
      setPollErrors((n) => n + 1);
    }
  }, [job.togetherJobId, isTerminal, initialJob.status, initialJob.modelSuffix]);

  // v5: Adaptive interval scheduling
  useEffect(() => {
    if (isTerminal || pollingStopped) return;

    // Stop conditions
    if (pollCount >= POLL_MAX_TOTAL) {
      setPollingStopped(true);
      return;
    }
    if (pollErrors >= POLL_MAX_ERRORS) {
      setPollingStopped(true);
      return;
    }

    // Determine interval for this cycle
    let intervalMs: number;
    if (pollErrors >= 3) {
      intervalMs = POLL_ERROR_MS;       // slowed due to errors
    } else if (pollCount < POLL_FAST_COUNT) {
      intervalMs = POLL_FAST_MS;        // fast early polls
    } else {
      intervalMs = POLL_SLOW_MS;        // steady slow poll
    }

    poll(); // immediate
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, isTerminal, pollCount, pollErrors, pollingStopped]);

  const handleCancel = async () => {
    if (!confirm(`Cancel training for "${job.modelSuffix}"? Credits will be refunded.`)) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/jobs/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, reason: "User cancelled from dashboard" }),
      });
      const data = await res.json() as { cancelled?: boolean; creditsRefunded?: number; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Cancel failed");

      setJob((prev) => ({ ...prev, status: "cancelled" }));
      toast.success(`Job cancelled. ${data.creditsRefunded ?? 0} credits refunded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={`cyber-card p-4 transition-all ${job.status === "completed" ? "border-green-500/20" : job.status === "failed" ? "border-red-500/20" : ""}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {isActive && <Loader2 className="w-4 h-4 text-cyan-neon animate-spin flex-shrink-0" />}
          {job.status === "completed" && <span className="text-green-400 text-sm">✅</span>}
          {job.status === "failed" && <span className="text-red-400 text-sm">❌</span>}
          {job.status === "cancelled" && <span className="text-white/40 text-sm">🚫</span>}

          <div>
            <span className="font-display text-sm font-bold text-white">{job.modelSuffix}</span>
            <span className="font-mono text-xs text-muted-foreground ml-2">
              {job.baseModel.split("/")[1]?.split("-").slice(0, 4).join("-")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* v5: Adaptive polling status indicators */}
          {pollingStopped && isActive && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-orange-400 border border-orange-400/20 px-1.5 py-0.5 rounded">
                POLLING STOPPED
              </span>
              <button
                onClick={() => { setPollingStopped(false); setPollErrors(0); setPollCount(0); }}
                className="font-mono text-[10px] text-cyan-neon border border-cyan-neon/20 px-1.5 py-0.5 rounded hover:bg-cyan-neon/10 transition-colors"
              >
                RETRY
              </button>
            </div>
          )}
          {!pollingStopped && pollErrors >= 3 && isActive && (
            <span className="font-mono text-[10px] text-yellow-400 border border-yellow-400/20 px-1.5 py-0.5 rounded">
              SLOW POLL
            </span>
          )}

          {job.progressPercent > 0 && (
            <span className="font-mono text-xs text-cyan-neon font-bold">{job.progressPercent}%</span>
          )}

          <span className={statusClass(job.status)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {job.status}
          </span>

          {/* Cancel button — only for active jobs */}
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
              title="Cancel job"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {/* Link to model when completed */}
          {job.status === "completed" && job.fineTunedModelId && (
            <Link
              href={`/playground/${job.fineTunedModelId}`}
              className="p-1.5 rounded hover:bg-cyan-neon/10 text-muted-foreground hover:text-cyan-neon transition-colors"
              title="Open in Playground"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-void-400 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            job.status === "completed" ? "bg-green-400" :
            job.status === "failed" ? "bg-red-400" :
            job.status === "cancelled" ? "bg-white/20" :
            "bg-cyan-neon"
          }`}
          style={{ width: `${job.status === "completed" ? 100 : job.progressPercent}%` }}
        />
      </div>

      {/* Epoch progress + stats */}
      {(job.currentEpoch > 0 || job.trainingTokens > 0) && (
        <div className="flex gap-4 mb-3 font-mono text-[10px] text-muted-foreground">
          {job.currentEpoch > 0 && (
            <span>Epoch {job.currentEpoch}/{job.epochs}</span>
          )}
          {job.trainingTokens > 0 && (
            <span>{job.trainingTokens.toLocaleString()} tokens trained</span>
          )}
          {job.creditsDeducted > 0 && (
            <span>{job.creditsDeducted} credits</span>
          )}
        </div>
      )}

      {/* Error message */}
      {job.errorMessage && (
        <div className="mb-3 p-2 rounded bg-red-500/5 border border-red-500/15">
          <p className="font-mono text-xs text-red-400">{job.errorMessage}</p>
        </div>
      )}

      {/* Terminal logs — collapsible */}
      {logs.length > 0 && (
        <div>
          <button
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-white transition-colors mb-1.5"
          >
            {logsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {logsExpanded ? "HIDE LOGS" : `SHOW LOGS (${logs.length} lines)`}
          </button>

          {logsExpanded && (
            <div className="terminal-log max-h-48 text-[11px]">
              {logs.map((line, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    line.includes("❌") || line.includes("ERROR") ? "text-red-400" :
                    line.includes("✅") || line.includes("complete") ? "text-green-400" :
                    line.includes("⚠️") || line.includes("WARN") ? "text-yellow-400" :
                    line.includes("💰") ? "text-cyan-neon" :
                    "opacity-80"
                  }`}
                >
                  {line}
                </div>
              ))}
              {isActive && <div className="cursor-blink" />}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        {job.togetherJobId && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Together ID: <span className="text-cyan-neon/50">{job.togetherJobId.slice(0, 20)}…</span>
          </span>
        )}
        {isActive && pollErrors >= 3 && (
          <span className="font-mono text-[10px] text-yellow-400">
            Poll errors: {pollErrors} — retrying in 20s
          </span>
        )}
      </div>
    </div>
  );
}

