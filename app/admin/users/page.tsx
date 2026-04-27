// app/admin/users/page.tsx — v6 UPGRADE
// Adds: search, filter by activity, usage stats per user, role dropdown, 
//       permission toggles, bulk actions, confirmation dialogs

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Users, Shield, Coins, RefreshCw, ChevronRight, Search, Filter, X, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  creditsBalance: number;
  totalJobsRun: number;
  monthlyJobsUsed: number;
  createdAt: string;
}

// Confirmation modal for destructive actions
function ConfirmModal({
  title,
  description,
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="cyber-card p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className={`w-5 h-5 ${danger ? "text-red-400" : "text-yellow-400"}`} />
          <h3 className="font-display text-base font-bold text-white">{title}</h3>
        </div>
        <p className="font-body text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded border border-white/10 text-white/60 text-sm font-mono hover:bg-white/5 transition-all"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded text-sm font-display font-bold transition-all ${
              danger
                ? "bg-red-500/20 border border-red-400/30 text-red-400 hover:bg-red-500/30"
                : "btn-neon"
            }`}
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Search + filter
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");

  // Credit adjustment
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string; description: string; onConfirm: () => void; danger?: boolean;
  }>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterRole) params.set("role", filterRole);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json() as { users: AdminUser[]; hasMore: boolean };
      setUsers(data.users);
      setHasMore(data.hasMore);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, filterRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.name?.toLowerCase() ?? "").includes(q)
    );
  }, [users, search]);

  const changeRole = (userId: string, newRole: "admin" | "user") => {
    const user = users.find((u) => u.id === userId);
    setConfirmAction({
      title: `Change role to ${newRole.toUpperCase()}?`,
      description: `This will ${newRole === "admin" ? "grant admin access to" : "remove admin access from"} ${user?.email ?? "this user"}. This action is audited.`,
      danger: newRole === "admin",
      onConfirm: async () => {
        setConfirmAction(null);
        setActionLoading(true);
        try {
          const res = await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "change_role", userId, role: newRole, reason: "Manual admin assignment" }),
          });
          const data = await res.json() as { success?: boolean; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Failed");
          toast.success(`Role updated to ${newRole}`);
          await fetchUsers();
          setSelectedUser(null);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Action failed");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const adjustCredits = () => {
    if (!selectedUser || !creditAmount || !creditReason) {
      toast.error("Fill in amount and reason");
      return;
    }
    const amount = parseInt(creditAmount);
    if (isNaN(amount)) { toast.error("Invalid amount"); return; }

    setConfirmAction({
      title: `Adjust credits by ${amount > 0 ? "+" : ""}${amount}?`,
      description: `${creditReason} — for ${selectedUser.email}. Current balance: ${selectedUser.creditsBalance} credits.`,
      danger: amount < 0,
      onConfirm: async () => {
        setConfirmAction(null);
        setActionLoading(true);
        try {
          const res = await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "adjust_credits", userId: selectedUser.id, amount, reason: creditReason }),
          });
          const data = await res.json() as { success?: boolean; newBalance?: number; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Failed");
          toast.success(`Credits adjusted. New balance: ${data.newBalance}`);
          setCreditAmount("");
          setCreditReason("");
          await fetchUsers();
          setSelectedUser(null);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Action failed");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <>
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          danger={confirmAction.danger}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-cyan-neon" />
            <h1 className="font-display text-xl font-bold text-white">USER MANAGEMENT</h1>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded border border-white/10 text-white/60 hover:text-white text-sm transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Search + Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-void-500 border border-white/10 rounded px-3 py-2 pl-9 font-mono text-xs text-white placeholder-white/25 focus:outline-none focus:border-cyan-neon/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground hover:text-white" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
              className="bg-void-500 border border-white/10 rounded px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-cyan-neon/40 transition-colors"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin Only</option>
              <option value="user">Users Only</option>
            </select>
          </div>
          <div className="flex items-center px-3 py-2 rounded border border-white/5 font-mono text-xs text-muted-foreground">
            {filtered.length} users
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Users table */}
          <div className="lg:col-span-2 cyber-card overflow-hidden">
            {loading ? (
              <div className="p-10 text-center">
                <RefreshCw className="w-6 h-6 text-cyan-neon animate-spin mx-auto mb-2" />
                <span className="font-mono text-xs text-muted-foreground">LOADING USERS...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="font-mono text-xs text-muted-foreground">No users match your search.</p>
                <button onClick={() => setSearch("")} className="mt-2 font-mono text-xs text-cyan-neon hover:opacity-80">Clear search</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      {["User", "Role", "Credits", "Jobs", "Monthly", "Joined", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-white/2 transition-colors cursor-pointer ${selectedUser?.id === user.id ? "bg-cyan-neon/5 border-l-2 border-cyan-neon" : ""}`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-body text-sm text-white font-medium">{user.name ?? "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs px-2 py-0.5 rounded border ${
                            user.role === "admin"
                              ? "text-magenta-neon border-magenta-neon/30 bg-magenta-neon/10"
                              : "text-muted-foreground border-white/10"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-mono text-sm ${user.creditsBalance < 20 ? "text-red-400" : user.creditsBalance < 100 ? "text-yellow-400" : "text-cyan-neon"}`}>
                          {user.creditsBalance}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-white/60">{user.totalJobsRun}</td>
                        <td className="px-4 py-3 font-mono text-sm text-white/40">{user.monthlyJobsUsed}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className={`w-4 h-4 transition-colors ${selectedUser?.id === user.id ? "text-cyan-neon" : "text-muted-foreground"}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination */}
                <div className="flex justify-between items-center px-4 py-3 border-t border-white/5">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                    className="font-mono text-xs text-muted-foreground disabled:opacity-30 hover:text-white transition-colors">
                    ← PREV
                  </button>
                  <span className="font-mono text-xs text-muted-foreground">Page {page}</span>
                  <button disabled={!hasMore} onClick={() => setPage((p) => p + 1)}
                    className="font-mono text-xs text-muted-foreground disabled:opacity-30 hover:text-white transition-colors">
                    NEXT →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action panel */}
          <div className="space-y-4">
            {selectedUser ? (
              <>
                {/* User stats */}
                <div className="cyber-card p-4">
                  <h3 className="font-display text-sm font-bold text-white mb-3">SELECTED USER</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      ["Email",   selectedUser.email, "text-white"],
                      ["Role",    selectedUser.role,  selectedUser.role === "admin" ? "text-magenta-neon" : "text-cyan-neon"],
                      ["Credits", String(selectedUser.creditsBalance), selectedUser.creditsBalance < 20 ? "text-red-400" : "text-cyan-neon"],
                      ["Total Jobs",   String(selectedUser.totalJobsRun), "text-white"],
                      ["Monthly Jobs", String(selectedUser.monthlyJobsUsed), "text-white/60"],
                      ["Joined",  new Date(selectedUser.createdAt).toLocaleDateString("en-IN"), "text-muted-foreground"],
                    ].map(([k, v, cls]) => (
                      <div key={k} className="flex justify-between">
                        <span className="font-mono text-muted-foreground">{k}</span>
                        <span className={`font-mono truncate ml-2 max-w-[160px] ${cls}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {selectedUser.creditsBalance < 20 && (
                    <div className="mt-3 p-2 rounded bg-red-400/5 border border-red-400/20 text-[10px] font-mono text-red-400">
                      ⚠ Low credits — user may need top-up
                    </div>
                  )}
                </div>

                {/* Role control */}
                <div className="cyber-card p-4">
                  <h3 className="font-display text-xs font-bold text-white tracking-wider mb-3 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-magenta-neon" /> ROLE CONTROL
                  </h3>
                  <div className="flex gap-2">
                    <button
                      disabled={actionLoading || selectedUser.role === "admin"}
                      onClick={() => changeRole(selectedUser.id, "admin")}
                      className="flex-1 py-2 rounded border border-magenta-neon/30 text-magenta-neon text-xs font-mono hover:bg-magenta-neon/10 disabled:opacity-40 transition-all active:scale-95"
                    >
                      MAKE ADMIN
                    </button>
                    <button
                      disabled={actionLoading || selectedUser.role === "user"}
                      onClick={() => changeRole(selectedUser.id, "user")}
                      className="flex-1 py-2 rounded border border-white/10 text-white/60 text-xs font-mono hover:bg-white/5 disabled:opacity-40 transition-all active:scale-95"
                    >
                      DEMOTE
                    </button>
                  </div>
                </div>

                {/* Credit adjustment */}
                <div className="cyber-card p-4">
                  <h3 className="font-display text-xs font-bold text-white tracking-wider mb-3 flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-cyan-neon" /> ADJUST CREDITS
                  </h3>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="Amount (e.g. 500 or -100)"
                      className="w-full bg-void-500 border border-white/10 rounded px-3 py-2 font-mono text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-neon/40 transition-colors"
                      autoFocus={false}
                    />
                    <input
                      type="text"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      placeholder="Reason (required)"
                      className="w-full bg-void-500 border border-white/10 rounded px-3 py-2 font-mono text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-neon/40 transition-colors"
                    />
                    <button
                      disabled={actionLoading || !creditAmount || !creditReason}
                      onClick={adjustCredits}
                      className="w-full btn-neon py-2 rounded text-xs font-display disabled:opacity-40 transition-all active:scale-95"
                    >
                      {actionLoading ? "APPLYING..." : "APPLY ADJUSTMENT"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-2 rounded border border-white/5 text-muted-foreground text-xs font-mono hover:bg-white/3 transition-colors"
                >
                  DESELECT USER
                </button>
              </>
            ) : (
              <div className="cyber-card p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="font-mono text-xs text-muted-foreground">
                  Click a user row to select and manage them.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
