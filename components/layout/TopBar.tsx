// components/layout/TopBar.tsx — v7 POLISH
// Premium topbar: breadcrumbs, trust indicators, smooth notification panel,
// low-credit pulse warning, consistent spacing

"use client";

import { UserButton } from "@clerk/nextjs";
import { Coins, Bell, Zap, ChevronRight, Shield, CheckCircle, X } from "lucide-react";
import type { User } from "@/lib/db/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface TopBarProps { user: User; isDemo?: boolean; }

// Breadcrumb path builder — returns array of { label, href }
function getBreadcrumbs(pathname: string): Array<{ label: string; href: string }> {
  const map: Record<string, string> = {
    "dashboard":    "Dashboard",
    "train":        "Train Model",
    "models":       "My Models",
    "playground":   "Playground",
    "billing":      "Billing",
    "integrate":    "Integration",
    "settings":     "Settings",
    "admin":        "Admin",
    "analytics":    "Analytics",
    "config":       "System Config",
    "users":        "Users",
    "audit":        "Audit Logs",
    "ai-assistant": "AI Brain",
    "errors":       "Error Monitor",
    "rollback":     "Rollback",
  };

  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string }> = [];
  let path = "";
  for (const part of parts) {
    path += `/${part}`;
    const label = map[part];
    if (label) crumbs.push({ label, href: path });
  }
  return crumbs;
}

const LOW_CREDITS = 50;
const CRITICAL_CREDITS = 20;

export default function TopBar({ user, isDemo = false }: TopBarProps) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const isLow      = user.creditsBalance <= LOW_CREDITS;
  const isCritical = user.creditsBalance <= CRITICAL_CREDITS;
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notif on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  return (
    <>
    {isDemo && (
      <div className="w-full py-1.5 px-4 text-center text-xs font-mono bg-yellow-400/10 border-b border-yellow-400/20 text-yellow-400 flex items-center justify-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
        <span>DEMO MODE — Data is simulated. <Link href="/sign-up" className="underline hover:opacity-80">Create your account</Link> to train real AI models.</span>
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
      </div>
    )}
    <header
      className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-30"
      style={{ background: "rgba(11,11,24,0.88)", backdropFilter: "blur(14px)" }}
    >
      {/* ── Left: breadcrumbs ──────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 pl-10 md:pl-0 min-w-0">
        <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest hidden md:block flex-shrink-0">
          neurofast
        </span>
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3 h-3 text-white/15 hidden md:block flex-shrink-0" />
            {i === crumbs.length - 1 ? (
              <span className="font-mono text-xs text-white/70 truncate">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="font-mono text-xs text-white/35 hover:text-white/60 transition-colors truncate hidden md:block">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </div>

      {/* ── Right: controls ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Trust indicator — shown on secure pages */}
        <div className="trust-badge hidden lg:flex">
          <Shield className="w-3 h-3" />
          <span>Secure</span>
        </div>

        {/* Critical credits alert */}
        {isCritical && (
          <Link href="/billing"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono animate-glow-pulse"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
            {user.creditsBalance} credits left
          </Link>
        )}

        {/* Low credits warning */}
        {isLow && !isCritical && (
          <Link href="/billing"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:scale-105"
            style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.25)", color: "#facc15" }}
          >
            <Zap className="w-3 h-3" /> Top up
          </Link>
        )}

        {/* Credits badge */}
        <Link
          href="/billing"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: "rgba(0,240,255,0.06)", border: "1px solid rgba(0,240,255,0.12)" }}
        >
          <Coins className="w-3.5 h-3.5 text-cyan-neon flex-shrink-0" />
          <span className={`font-mono text-xs font-semibold tabular-nums ${isCritical ? "text-red-400" : isLow ? "text-yellow-400" : "text-cyan-neon"}`}>
            {user.creditsBalance.toLocaleString("en-IN")}
          </span>
          <span className="font-mono text-[10px] text-white/35 uppercase tracking-wider hidden sm:block">cr</span>
        </Link>

        {/* Plan badge */}
        <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-md hidden md:block ${
          user.plan === "free"
            ? "text-white/30 border border-white/8"
            : "text-magenta-neon border border-magenta-neon/28"
        }`}>
          {user.plan}
        </span>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg text-white/45 hover:text-white hover:bg-white/5 transition-all"
          >
            <Bell className="w-4 h-4" />
            {isLow && <span className="notif-dot" />}
          </button>

          {notifOpen && (
            <div
              className="absolute top-12 right-0 w-72 rounded-xl overflow-hidden z-50 animate-fade-down"
              style={{
                background: "var(--surface-4, #16162c)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.6)"
              }}
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <span className="font-mono text-xs text-white/55 uppercase tracking-wider">Notifications</span>
                <button onClick={() => setNotifOpen(false)} className="text-white/30 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2">
                {isLow ? (
                  <Link href="/billing" onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/4 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ background: isCritical ? "rgba(248,113,113,0.1)" : "rgba(250,204,21,0.1)" }}>
                      <Zap className={`w-4 h-4 ${isCritical ? "text-red-400" : "text-yellow-400"}`} />
                    </div>
                    <div>
                      <p className="font-body text-sm text-white">{isCritical ? "Credits critical" : "Credits running low"}</p>
                      <p className="font-mono text-xs text-white/40 mt-0.5">{user.creditsBalance} remaining — top up to continue</p>
                    </div>
                  </Link>
                ) : (
                  <div className="p-4 text-center py-8">
                    <CheckCircle className="w-7 h-7 text-green-400/30 mx-auto mb-2" />
                    <p className="font-mono text-xs text-white/35">All good — no alerts</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8 ring-1 ring-cyan-neon/20 hover:ring-cyan-neon/45 transition-all duration-200 rounded-full",
            },
          }}
        />
      </div>
    </header>
    </>
  );
}
