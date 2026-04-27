// app/admin/layout.tsx — v6 UPGRADE
// Added: Rollback, Errors, Terms nav items; active link highlighting; session display

import { requireUser } from "@/lib/auth";
import { hasRole } from "@/lib/services/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import {
  Shield, Users, Settings, Activity, Cpu,
  LayoutDashboard, TrendingUp, AlertTriangle,
  History, FileText, ArrowLeft,
} from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!hasRole(user.role, "admin")) redirect("/dashboard");

  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "";

  const adminNav = [
    { href: "/admin",              icon: LayoutDashboard, label: "Overview",     group: "main" },
    { href: "/admin/analytics",    icon: TrendingUp,      label: "Analytics",    group: "main" },
    { href: "/admin/users",        icon: Users,           label: "Users",        group: "main" },
    { href: "/admin/config",       icon: Settings,        label: "System Config",group: "main" },
    { href: "/admin/audit",        icon: Activity,        label: "Audit Logs",   group: "main" },
    { href: "/admin/errors",       icon: AlertTriangle,   label: "Errors",       group: "monitor" },
    { href: "/admin/rollback",     icon: History,         label: "Rollback",     group: "monitor" },
    { href: "/admin/ai-assistant", icon: Cpu,             label: "AI Brain",     group: "ai" },
    { href: "/terms",              icon: FileText,        label: "Terms & Docs", group: "other" },
  ];

  const groups = [
    { key: "main",    label: "Management" },
    { key: "monitor", label: "Monitoring" },
    { key: "ai",      label: "AI Control" },
    { key: "other",   label: "Platform" },
  ];

  return (
    <div className="flex h-screen bg-void-black overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r" style={{ background: "#0b0b18", borderColor: "rgba(255,0,170,0.08)" }}>
        {/* Header */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-magenta-neon" />
            <span className="font-display text-sm font-bold text-magenta-neon tracking-wider">ADMIN PANEL</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground truncate">{user.email}</div>
          <div className="font-mono text-[9px] text-magenta-neon/40 mt-0.5 uppercase tracking-widest">
            {user.role}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {groups.map((group) => {
            const items = adminNav.filter((n) => n.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 px-2 mb-1.5">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href ||
                      (item.href !== "/admin" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all relative ${
                          isActive
                            ? "bg-magenta-neon/10 border border-magenta-neon/20 text-magenta-neon"
                            : "text-muted-foreground hover:text-white hover:bg-white/4 border border-transparent"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-magenta-neon rounded-r" />
                        )}
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-magenta-neon" : ""}`} />
                        <span className="font-body text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-5 border-t border-white/5 pt-3 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to App
          </Link>
        </div>
      </aside>

      {/* Admin content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
