// components/admin/SyncJobsButton.tsx
// Triggers the /api/jobs/poll endpoint to sync all active job statuses
// Used when worker is down or for manual admin refresh

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, CheckCircle } from "lucide-react";

interface PollResult {
  synced: number;
  durationMs: number;
  results: Array<{ dbJobId: string; togetherJobId: string; oldStatus: string; newStatus: string; error?: string }>;
}

export default function SyncJobsButton() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<PollResult | null>(null);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/poll", { method: "POST" });
      const data = await res.json() as PollResult & { message?: string; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setLastResult(data);

      const statusChanges = data.results?.filter((r) => r.oldStatus !== r.newStatus).length ?? 0;
      const errors = data.results?.filter((r) => r.error).length ?? 0;

      if (data.synced === 0) {
        toast.info(data.message ?? "No active jobs to sync");
      } else if (errors > 0) {
        toast.warning(`Synced ${data.synced} jobs (${errors} errors) in ${data.durationMs}ms`);
      } else {
        toast.success(`✅ Synced ${data.synced} jobs · ${statusChanges} status changes · ${data.durationMs}ms`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded border border-cyan-neon/20 bg-cyan-neon/5 text-cyan-neon text-xs font-mono hover:bg-cyan-neon/10 disabled:opacity-40 transition-all"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "SYNCING..." : "SYNC ALL JOBS"}
      </button>

      {lastResult && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-green-400">
          <CheckCircle className="w-3 h-3" />
          <span>{lastResult.synced} synced</span>
        </div>
      )}
    </div>
  );
}
