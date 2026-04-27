// app/(app)/settings/page.tsx
import { requireUser } from "@/lib/auth";
import { UserButton } from "@clerk/nextjs";
import { Key, User, CreditCard, Shield, Lock } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          ACCOUNT <span className="text-cyan-neon">SETTINGS</span>
        </h1>
        <p className="font-body text-muted-foreground mt-1">
          Manage your profile, API keys, and account preferences.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="trust-badge"><Shield className="w-3 h-3" /> Your data is encrypted</span>
        </div>
      </div>

      {/* Profile */}
      <div className="cyber-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-cyan-neon" />
          <h2 className="font-display text-sm font-bold text-white tracking-wider">PROFILE</h2>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <UserButton appearance={{ elements: { avatarBox: "w-14 h-14 ring-2 ring-cyan-neon/30" } }} />
          <div>
            <div className="font-body text-white font-medium">{user.name ?? "Anonymous"}</div>
            <div className="font-mono text-xs text-muted-foreground">{user.email}</div>
            <div className="font-mono text-xs text-cyan-neon mt-0.5">{user.plan.toUpperCase()} PLAN</div>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Profile managed via Clerk. Click the avatar to update name, email, or password.
        </p>
      </div>

      {/* API Key */}
      <div className="cyber-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-cyan-neon" />
          <h2 className="font-display text-sm font-bold text-white tracking-wider">API ACCESS</h2>
        </div>
        <div className="bg-void-400 rounded p-4 font-mono text-xs border border-white/5 mb-3">
          <div className="text-muted-foreground mb-1">Your deployed models are accessible at:</div>
          <div className="text-cyan-neon break-all">
            POST https://api.together.xyz/v1/chat/completions
          </div>
          <div className="text-muted-foreground mt-2">Model ID format:</div>
          <div className="text-white">your-together-username/{`{model-suffix}`}</div>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Use your Together AI API key directly in your applications. Your fine-tuned models are registered under your Together account.
        </p>
      </div>

      {/* Plan info */}
      <div className="cyber-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-cyan-neon" />
          <h2 className="font-display text-sm font-bold text-white tracking-wider">PLAN & USAGE</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            { label: "Current Plan", value: user.plan.toUpperCase() },
            { label: "Credits Balance", value: user.creditsBalance.toLocaleString() },
            { label: "Total Jobs Run", value: user.totalJobsRun },
            { label: "Jobs This Month", value: user.monthlyJobsUsed },
          ].map(({ label, value }) => (
            <div key={label} className="bg-void-400 rounded p-3 border border-white/5">
              <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">{label}</div>
              <div className="font-mono text-sm text-white font-semibold">{String(value)}</div>
            </div>
          ))}
        </div>
        <a href="/billing" className="btn-neon px-4 py-2 rounded text-xs font-display inline-flex items-center gap-2">
          MANAGE BILLING →
        </a>
      </div>

      {/* Security */}
      <div className="cyber-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-cyan-neon" />
          <h2 className="font-display text-sm font-bold text-white tracking-wider">SECURITY</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: "Two-Factor Authentication", desc: "Managed via Clerk — enable in profile settings", status: "Available" },
            { label: "Session Management", desc: "View and revoke active sessions", status: "Clerk Managed" },
            { label: "Data Encryption", desc: "All datasets encrypted at rest in Supabase", status: "Enabled" },
          ].map(({ label, desc, status }) => (
            <div key={label} className="flex items-start justify-between p-3 rounded bg-void-400 border border-white/5">
              <div>
                <div className="font-body text-sm text-white font-medium">{label}</div>
                <div className="font-mono text-xs text-muted-foreground">{desc}</div>
              </div>
              <span className="font-mono text-xs text-green-400 flex-shrink-0 mt-1">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
