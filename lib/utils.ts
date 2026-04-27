// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCredits(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function formatRelativeTime(d: Date | string | null): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function truncateModelId(id: string, max = 30): string {
  if (id.length <= max) return id;
  return `${id.slice(0, max)}…`;
}

// Status color helpers
export function statusClass(status: string): string {
  switch (status) {
    case "running": return "status-running";
    case "completed": return "status-completed";
    case "failed": return "status-failed";
    case "queued":
    case "pending": return "status-pending";
    default: return "status-pending";
  }
}

export function statusDot(status: string): string {
  switch (status) {
    case "running": return "bg-cyan-neon animate-pulse";
    case "completed": return "bg-green-400";
    case "failed": return "bg-red-400";
    default: return "bg-yellow-400 animate-pulse";
  }
}
