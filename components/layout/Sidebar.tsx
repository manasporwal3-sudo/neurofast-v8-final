// components/layout/Sidebar.tsx — v7 POLISH
// Premium sidebar: smooth collapse, tooltip on collapsed, pulse dots,
// consistent active states, mobile slide animation

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Zap, Brain, MessageSquare,
  CreditCard, Link2, Settings, ChevronRight,
  Shield, Menu, X, Activity, AlertTriangle,
  History, FileText, FlaskConical, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { User } from "@/lib/db/schema";

const NAV_ITEMS = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard"      },
  { href: "/train",      icon: Zap,             label: "Train Model"    },
  { href: "/models",     icon: Brain,           label: "My Models"      },
  { href: "/playground", icon: MessageSquare,   label: "Playground"     },
  { href: "/billing",    icon: Coins,           label: "Billing"        },
  { href: "/integrate",  icon: Link2,           label: "Integration"    },
  { href: "/settings",   icon: Settings,        label: "Settings"       },
];

const ADMIN_ITEMS = [
  { href: "/admin",              icon: Shield,        label: "Overview"      },
  { href: "/admin/analytics",    icon: Activity,      label: "Analytics"     },
  { href: "/admin/users",        icon: Brain,         label: "Users"         },
  { href: "/admin/config",       icon: Settings,      label: "Config"        },
  { href: "/admin/audit",        icon: Zap,           label: "Audit Logs"    },
  { href: "/admin/errors",       icon: AlertTriangle, label: "Errors"        },
  { href: "/admin/rollback",     icon: History,       label: "Rollback"      },
  { href: "/admin/ai-assistant", icon: Brain,         label: "AI Brain"      },
];

interface SidebarProps { isAdmin?: boolean; user?: User }

export default function Sidebar({ isAdmin = false, user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);
  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && href !== "/" && pathname.startsWith(href));

  const NavLink = ({
    item,
  }: {
    item: { href: string; icon: React.ElementType; label: string; dot?: string };
  }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group",
          active
            ? "bg-cyan-neon/10 border border-cyan-neon/18 text-cyan-neon"
            : "text-white/45 hover:text-white hover:bg-white/5 border border-transparent",
          collapsed && "justify-center px-2"
        )}
      >
        {/* Active left bar */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-neon rounded-r" />
        )}

        {/* Icon + optional dot */}
        <div className="relative flex-shrink-0">
          <Icon className={cn(
            "transition-colors",
            collapsed ? "w-5 h-5" : "w-4 h-4",
            active ? "text-cyan-neon" : "group-hover:text-white/80"
          )} />
          {item.dot && (
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0d0d1a] ${item.dot}`} />
          )}
        </div>

        {/* Label */}
        {!collapsed && (
          <span className="flex-1 font-sans text-sm leading-none">{item.label}</span>
        )}
        {!collapsed && active && (
          <ChevronRight className="w-3 h-3 text-cyan-neon/40 flex-shrink-0" />
        )}
      </Link>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-white/5 transition-all",
        collapsed ? "px-2 py-4 justify-center" : "px-4 py-4"
      )}>
        <div
          className="w-8 h-8 rounded-lg border border-cyan-neon/45 flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: "rgba(0,240,255,0.07)" }}
        >
          <span className="font-bold text-cyan-neon text-xs" style={{ fontFamily: "Orbitron,sans-serif" }}>NF</span>
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <div className="font-bold text-white text-sm tracking-wide leading-none" style={{ fontFamily: "Orbitron,sans-serif" }}>
              NEUROFAST
            </div>
            <div className="text-[9px] text-cyan-neon/45 font-mono tracking-widest mt-0.5">AI TRAINER</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* Demo link */}
        <div className="pt-2 pb-1">
          <NavLink item={{ href: "/demo", icon: FlaskConical, label: "Try Demo" }} />
        </div>

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className={cn("pt-5 pb-2", collapsed ? "hidden" : "")}>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 px-3">
                Admin
              </div>
            </div>
            {collapsed && <div className="my-2 divider" />}
            {ADMIN_ITEMS.map((item) => (
              <NavLink key={item.href} item={{ ...item }} />
            ))}
            {!collapsed && (
              <NavLink item={{ href: "/terms", icon: FileText, label: "Terms & Policies" }} />
            )}
          </>
        )}
      </nav>

      {/* Credits quick view (when expanded) */}
      {!collapsed && user && (
        <div className="px-3 pb-2">
          <Link href="/billing"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-cyan-neon/70" />
              <span className="font-mono text-xs text-white/50">Credits</span>
            </div>
            <span className={`font-mono text-xs font-bold ${
              user.creditsBalance < 20 ? "text-red-400" :
              user.creditsBalance < 50 ? "text-yellow-400" :
              "text-cyan-neon"
            }`}>
              {user.creditsBalance.toLocaleString("en-IN")}
            </span>
          </Link>
        </div>
      )}

      {/* Collapse toggle */}
      <div className={cn("px-2 pb-4", collapsed ? "flex justify-center" : "")}>
        <button
          onClick={toggleCollapse}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl border border-white/7 text-white/35 hover:text-white hover:border-white/14 transition-all text-xs font-mono",
            collapsed ? "w-10 h-10" : "w-full px-3 py-2"
          )}
        >
          <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", !collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-50 p-2 rounded-xl border border-white/10 text-white/70 hover:text-white transition-all"
        style={{ background: "rgba(13,13,26,0.9)", backdropFilter: "blur(8px)" }}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-white/6 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "#0d0d1a" }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen border-r border-white/6 transition-all duration-300 ease-out flex-shrink-0 relative z-20",
          collapsed ? "w-[60px]" : "w-[228px]"
        )}
        style={{ background: "#0d0d1a" }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
