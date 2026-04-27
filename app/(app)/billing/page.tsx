// app/(app)/billing/page.tsx
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { payments, creditTransactions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatDate, formatCredits } from "@/lib/utils";
import BuyCreditsButton from "@/components/billing/BuyCreditsButton";
import { Coins, Receipt, TrendingUp } from "lucide-react";

const CREDIT_PACKS = [
  { credits: 500, priceINR: 299, label: "Starter", desc: "~2-3 small training jobs" },
  { credits: 1000, priceINR: 499, label: "Builder", desc: "~5 training jobs on 8B models", popular: true },
  { credits: 3000, priceINR: 1299, label: "Pro", desc: "~15 training jobs, best value" },
  { credits: 10000, priceINR: 3999, label: "Enterprise", desc: "Unlimited usage for a month" },
];

export default async function BillingPage() {
  const user = await requireUser();

  const recentPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, user.id))
    .orderBy(desc(payments.createdAt))
    .limit(10);

  const recentTransactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, user.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(20);

  const totalSpent = recentPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          BILLING & <span className="text-cyan-neon">CREDITS</span>
        </h1>
        <p className="font-body text-muted-foreground mt-1">
          Manage credits, view invoices, top up via UPI or card.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <span className="trust-badge"><span>🔒</span> Secured by Razorpay</span>
          <span className="trust-badge"><span>✓</span> Instant credit delivery</span>
        </div>
      </div>

      {/* Balance overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="cyber-card p-6 cyber-card-cyan relative overflow-hidden">
          <div className="absolute inset-0 opacity-20"
            style={{ background: "radial-gradient(circle at 20% 80%, rgba(0,240,255,0.15), transparent 60%)" }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-neon/10 border border-cyan-neon/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-cyan-neon" />
              </div>
              <span className="font-mono text-xs text-white/50 uppercase tracking-wider">Credit Balance</span>
            </div>
            <div className="font-display text-4xl font-bold text-cyan-neon mb-1 tabular-nums">
              {formatCredits(user.creditsBalance)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`tag ${user.plan === "free" ? "" : "tag-magenta"} text-[10px]`}>
                {user.plan.toUpperCase()} PLAN
              </span>
              {user.creditsBalance < 50 && (
                <span className="tag tag-red text-[10px]">Low</span>
              )}
            </div>
          </div>
        </div>
        <div className="cyber-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-magenta-neon" />
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Total Spent</span>
          </div>
          <div className="font-display text-4xl font-bold text-white mb-1">
            ₹{totalSpent.toLocaleString("en-IN")}
          </div>
          <div className="font-mono text-xs text-muted-foreground">All time</div>
        </div>
        <div className="cyber-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-cyan-neon" />
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Jobs Run</span>
          </div>
          <div className="font-display text-4xl font-bold text-white mb-1">{user.totalJobsRun}</div>
          <div className="font-mono text-xs text-muted-foreground">Training jobs total</div>
        </div>
      </div>

      {/* Buy credits */}
      <div className="cyber-card p-6">
        <h2 className="font-display text-sm font-bold text-white tracking-wider mb-1">BUY CREDITS</h2>
        <p className="font-body text-muted-foreground text-sm mb-6">
          Pay securely via UPI, credit/debit card, or netbanking. Credits added instantly.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.credits}
              className={`relative p-5 rounded-lg border transition-all ${
                pack.popular
                  ? "border-cyan-neon/40 bg-cyan-neon/5"
                  : "border-white/5 bg-void-400"
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-cyan-neon text-void-black font-mono text-[10px] font-bold rounded-full">
                  POPULAR
                </div>
              )}
              <div className="font-display text-sm font-bold text-white mb-0.5">{pack.label}</div>
              <div className="font-display text-2xl font-bold text-cyan-neon mb-1">
                {pack.credits.toLocaleString()}
                <span className="font-mono text-xs text-muted-foreground ml-1">credits</span>
              </div>
              <div className="font-mono text-xs text-muted-foreground mb-3">{pack.desc}</div>
              <div className="font-display text-lg font-bold text-white mb-4">₹{pack.priceINR}</div>
              <BuyCreditsButton
                credits={pack.credits}
                priceINR={pack.priceINR}
                label={pack.label}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div className="cyber-card p-5">
        <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">CREDIT HISTORY</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-center font-mono text-xs text-muted-foreground py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded bg-void-400 border border-white/5"
              >
                <div>
                  <div className="font-body text-sm text-white">{tx.description}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-sm font-bold ${tx.amount > 0 ? "text-green-400" : "text-magenta-neon"}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    bal: {tx.balanceAfter}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice history */}
      {recentPayments.length > 0 && (
        <div className="cyber-card p-5">
          <h2 className="font-display text-sm font-bold text-white tracking-wider mb-4">PAYMENT HISTORY</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Date", "Amount", "Credits", "Status", "Payment ID"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-sm text-white">₹{parseFloat(String(p.amount)).toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-sm text-cyan-neon">+{p.creditsGranted}</td>
                    <td className="px-3 py-3">
                      <span className={p.status === "paid" ? "status-completed" : "status-pending"}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {p.razorpayPaymentId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
