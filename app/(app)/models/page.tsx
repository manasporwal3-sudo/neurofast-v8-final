// app/(app)/models/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Brain, MessageSquare, Settings, Trash2, Plus, Zap, Search, Filter, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import ModelStatusPoller from "@/components/models/ModelStatusPoller";
import { formatRelativeTime } from "@/lib/utils";

interface Model {
  id: string;
  name: string;
  baseModel: string;
  status: string;
  totalChats: number;
  createdAt: string;
}

interface Job {
  id: string;
  togetherJobId: string | null;
  modelSuffix: string;
  baseModel: string;
  status: string;
  progressPercent: number;
  createdAt: string;
  epochs: number;
  creditsDeducted: number;
  errorMessage: string | null;
  logs: string[];
}

interface ModelsData {
  models: Model[];
  runningJobs: Job[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; dot: string }> = {
    active:    { cls: "status-completed", label: "Active",    dot: "bg-green-400" },
    running:   { cls: "status-running",   label: "Training",  dot: "bg-cyan-neon animate-pulse" },
    queued:    { cls: "status-pending",   label: "Queued",    dot: "bg-yellow-400 animate-pulse" },
    failed:    { cls: "status-failed",    label: "Failed",    dot: "bg-red-400" },
    cancelled: { cls: "status-cancelled", label: "Cancelled", dot: "bg-white/30" },
    archived:  { cls: "status-cancelled", label: "Archived",  dot: "bg-white/20" },
  };
  const s = map[status] ?? map.active;
  return (
    <span className={s.cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function EmptyModels() {
  return (
    <div className="empty-state animate-fade-up">
      <div className="empty-state-icon animate-float">
        <Brain className="w-8 h-8 text-cyan-neon/55" />
      </div>
      <h3 className="empty-state-title">No AI models yet</h3>
      <p className="empty-state-desc">
        Train your first logistics AI on your own data — SKU forecasting, route optimization, demand prediction.
        Takes under an hour.
      </p>
      <Link href="/train" className="btn-neon text-sm px-6 py-3 rounded-xl flex items-center gap-2">
        <Zap className="w-4 h-4" />
        Train Your First Model
      </Link>
      <p className="font-mono text-[11px] text-white/25 mt-4">100 free credits included with your account</p>
    </div>
  );
}

function ModelCard({ model, onDelete }: { model: Model; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${model.name}"?\n\nThis will permanently remove the model and cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/models/${model.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`Model "${model.name}" deleted`);
      onDelete(model.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cyber-card p-5 group hover:border-cyan-neon/20 transition-all animate-fade-up">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.18)" }}>
            <Brain className="w-5 h-5 text-cyan-neon" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{model.name}</h3>
            <p className="font-mono text-[10px] text-white/40 mt-0.5">{model.baseModel.split("/")[1] ?? model.baseModel}</p>
          </div>
        </div>
        <StatusBadge status={model.status} />
      </div>

      <div className="flex items-center justify-between text-xs mb-5">
        <div className="flex items-center gap-1 text-white/40 font-mono">
          <MessageSquare className="w-3 h-3" />
          {model.totalChats} chats
        </div>
        <div className="flex items-center gap-1 text-white/40 font-mono">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(model.createdAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/playground/${model.id}`}
          className="flex-1 btn-neon text-xs py-2 rounded-lg justify-center"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </Link>
        <Link
          href={`/models/${model.id}/edit`}
          className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all"
          title="Edit"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 rounded-lg transition-all disabled:opacity-40"
          style={{ border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
          title="Delete"
        >
          <Trash2 className={`w-4 h-4 ${deleting ? "animate-pulse" : ""}`} />
        </button>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const [data, setData] = useState<ModelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Unable to load data. Please try again.");
      const json = await res.json() as { success: boolean; data: { models: Model[]; recentJobs: Job[] }; error: string | null };
      const d = json.data;
      setData({
        models: d.models,
        runningJobs: d.recentJobs.filter(j => ["running","queued","pending"].includes(j.status)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleDelete = (deletedId: string) => {
    setData(prev => prev ? { ...prev, models: prev.models.filter(m => m.id !== deletedId) } : null);
  };

  const filtered = data?.models.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.baseModel.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  }) ?? [];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-7 w-48 mb-2" />
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="skeleton h-10 w-32 rounded-lg" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cyber-card p-10 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-mono text-sm text-red-400 mb-4">{error}</p>
        <button onClick={fetchModels} className="btn-neon text-sm px-5 py-2.5 rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-white text-2xl tracking-wide mb-1" style={{ fontFamily: "Orbitron,sans-serif" }}>
            My <span className="text-neon-cyan">Models</span>
          </h1>
          <p className="text-sm text-white/50">
            {data?.models.length ?? 0} fine-tuned models · {data?.runningJobs.length ?? 0} training
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchModels} className="btn-icon" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/train" className="btn-neon text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
            <Plus className="w-4 h-4" /> Train New
          </Link>
        </div>
      </div>

      {/* Active training jobs */}
      {(data?.runningJobs.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="font-mono text-xs text-yellow-400 uppercase tracking-widest">In Training</h2>
          {data?.runningJobs.map(job => (
            <ModelStatusPoller key={job.id} job={job as never} />
          ))}
        </div>
      )}

      {/* Search + filter */}
      {(data?.models.length ?? 0) > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models..."
              className="input pl-9 text-sm h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/30" />
            {["all","active","failed","archived"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${statusFilter === s ? "bg-cyan-neon/10 border border-cyan-neon/30 text-cyan-neon" : "text-white/40 hover:text-white border border-white/8"}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Models grid */}
      {filtered.length === 0 && !loading ? (
        data?.models.length === 0 ? <EmptyModels /> : (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="font-mono text-sm text-white/40">No models match your search</p>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-cyan-neon mt-3 hover:opacity-80 font-mono">Clear filters</button>
          </div>
        )
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {filtered.map(model => (
            <ModelCard key={model.id} model={model} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
