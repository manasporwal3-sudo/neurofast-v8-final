// app/page.tsx — NeuroFast AI Trainer Landing Page
import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Brain, Zap, Shield, TrendingUp, CheckCircle, ArrowRight, Star, Package, Truck, BarChart3 } from "lucide-react";

const FEATURES = [
  { icon: Brain, title: "Fine-Tune Any LLM", desc: "Llama 3.1, Qwen 2.5, Mistral. LoRA training via Together AI — no GPU management needed.", color: "cyan" },
  { icon: Package, title: "Dark Store SKU AI", desc: "Pre-built logistics templates for SKU demand forecasting, reorder automation, and spoilage prediction.", color: "magenta" },
  { icon: Truck, title: "Fleet Routing Intelligence", desc: "Last-mile delivery AI optimized for Indian cities. Real-time rerouting, ETA prediction.", color: "cyan" },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Track token usage, training costs, model performance. Full ops visibility.", color: "magenta" },
  { icon: Shield, title: "Sovereign & Private", desc: "Your data never leaves your control. Fine-tuned models deployed on your account.", color: "cyan" },
  { icon: Zap, title: "Deploy in Minutes", desc: "Upload dataset, train, and chat with your model — all in under an hour.", color: "magenta" },
];

const PRICING = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    credits: "100 credits",
    desc: "Perfect to get started",
    features: ["1 training job/month", "8B parameter models", "Chat playground", "API access"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Builder",
    price: "₹499",
    period: "per pack",
    credits: "1,000 credits",
    desc: "For growing logistics teams",
    features: ["~5 training jobs", "All model sizes up to 32B", "Priority queue", "Team sharing"],
    cta: "Get Builder",
    highlight: true,
  },
  {
    name: "Pro",
    price: "₹1,299",
    period: "per pack",
    credits: "3,000 credits",
    desc: "For large operations",
    features: ["~15 training jobs", "72B parameter models", "Dedicated support", "Custom templates"],
    cta: "Get Pro",
    highlight: false,
  },
];

const TESTIMONIALS = [
  { name: "Rahul Sharma", role: "VP Ops, DarkMart", text: "Reduced our inventory stockouts by 34% in the first month. The SKU AI actually understands Diwali demand patterns.", avatar: "RS" },
  { name: "Priya Nair", role: "Tech Lead, QuickHaul", text: "Fleet routing model improved our SLA compliance from 78% to 94%. Setup took less than 2 hours.", avatar: "PN" },
  { name: "Amit Gupta", role: "Founder, LastMile.ai", text: "The only AI training platform that actually understands Indian logistics. Hindi-English mixing works perfectly.", avatar: "AG" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-40" style={{ background: "radial-gradient(ellipse, rgba(0,240,255,0.08) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full opacity-30" style={{ background: "radial-gradient(ellipse, rgba(255,0,170,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(0,240,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.012) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      {/* NAV */}
      <nav className="relative z-50 border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-cyan-neon/50 flex items-center justify-center" style={{ background: "rgba(0,240,255,0.08)" }}>
              <span className="font-bold text-cyan-neon text-sm" style={{ fontFamily: "Orbitron,sans-serif" }}>NF</span>
            </div>
            <div>
              <span className="font-bold text-white tracking-wide" style={{ fontFamily: "Orbitron,sans-serif", fontSize: "16px" }}>
                NEUROFAST <span className="text-neon-cyan">AI</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors font-medium">Features</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors font-medium">Pricing</a>
            <a href="#testimonials" className="text-sm text-white/60 hover:text-white transition-colors font-medium">Stories</a>
            <Link href="/demo" className="text-sm text-cyan-neon/70 hover:text-cyan-neon transition-colors font-medium border border-cyan-neon/20 px-3 py-1.5 rounded-lg hover:border-cyan-neon/40">
              Try Demo
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm text-white/55 hover:text-white transition-all px-4 py-2 rounded-lg hover:bg-white/4">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn-neon text-sm px-5 py-2.5 rounded-lg">
                  Start Free →
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn-neon text-sm px-5 py-2.5 rounded-lg font-semibold">
                Dashboard →
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-mono font-semibold" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.25)", color: "#00f0ff" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-neon animate-pulse" />
            Now with AI Control Brain — natural language admin
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight" style={{ fontFamily: "Orbitron,sans-serif" }}>
            <span className="text-white">Train Your Private</span>
            <br />
            <span className="gradient-text">Logistics AI</span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Fine-tune open-source LLMs on your dark-store, fleet, and inventory data.
            Deploy private GPT-level intelligence — <strong className="text-white/80">no GPU management, no complexity.</strong>
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <SignUpButton mode="modal">
              <button className="btn-neon text-base px-8 py-4 rounded-xl font-bold tracking-wide group">
                Start Training Free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </SignUpButton>
            <a href="#features" className="btn-secondary text-base px-8 py-4 rounded-xl">
              See How It Works
            </a>
          </div>

          {/* Social proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-white/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>100 free credits on signup</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Train in under 1 hour</span>
            </div>
          </div>
        </div>

        {/* Hero visual — terminal preview */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="cyber-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 font-mono text-xs text-white/40">neurofast-fleet-v1 · chat playground</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded bg-cyan-neon/10 border border-cyan-neon/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-cyan-neon">U</span>
                </div>
                <div className="bg-white/5 rounded-lg px-4 py-2.5 text-sm text-white/80 max-w-md">
                  What&apos;s the optimal delivery route for 8 orders across Koramangala today?
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded bg-magenta-neon/10 border border-magenta-neon/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-magenta-neon">AI</span>
                </div>
                <div style={{ background: "rgba(13,13,26,0.8)", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg px-4 py-3 text-sm text-white/90 max-w-lg">
                  <span className="text-cyan-neon font-mono text-xs block mb-2">ROUTE OPTIMIZED — 2 riders, 35min ETA</span>
                  Cluster orders into 2 groups by pin code. Rider 1: 4 stops (Koramangala 5th Block → HSR Layout). Rider 2: 4 stops (Indiranagar → Domlur). ETA: 35-42 minutes. Use Hosur Road until 6PM to avoid peak traffic...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative z-10 py-12 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "< 1hr", label: "Average training time" },
              { value: "7B–72B", label: "Model parameters" },
              { value: "₹0", label: "GPU cost to you" },
              { value: "99.9%", label: "Together AI uptime" },
            ].map(s => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-cyan-neon mb-1" style={{ fontFamily: "Orbitron,sans-serif" }}>{s.value}</div>
                <div className="text-xs text-white/50 font-mono uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>
              Built for <span className="text-neon-cyan">Indian Logistics</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">Pre-built templates for every logistics scenario. Festival demand, Hindi-English support, city-specific traffic patterns.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="cyber-card p-6 group">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color === "cyan" ? "bg-cyan-neon/10 border border-cyan-neon/20" : "bg-magenta-neon/10 border border-magenta-neon/20"}`}>
                    <Icon className={`w-5 h-5 ${f.color === "cyan" ? "text-cyan-neon" : "text-magenta-neon"}`} />
                  </div>
                  <h3 className={`font-bold text-sm mb-2 tracking-wide ${f.color === "cyan" ? "text-cyan-neon" : "text-magenta-neon"}`} style={{ fontFamily: "Orbitron,sans-serif" }}>{f.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>
              From Data to <span className="text-neon-cyan">Intelligence</span> in 4 Steps
            </h2>
          </div>
          <div className="space-y-6">
            {[
              { step: "01", title: "Upload Your Data", desc: "Drag & drop JSONL or CSV. Our system auto-converts it to training format. Or choose from 4 pre-built logistics templates.", icon: Package },
              { step: "02", title: "Select & Configure", desc: "Pick your base model (7B to 72B). Set epochs, LoRA rank. We estimate cost before you commit.", icon: Brain },
              { step: "03", title: "Train on Together AI", desc: "We handle all GPU management via Together AI. Real-time progress logs. Automatic credit refund if it fails early.", icon: Zap },
              { step: "04", title: "Deploy & Chat", desc: "Your model is live instantly. Share a link with your team. Integrate via OpenAI-compatible API.", icon: TrendingUp },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl border border-cyan-neon/30 flex items-center justify-center" style={{ background: "rgba(0,240,255,0.06)" }}>
                    <span className="font-bold text-cyan-neon text-xs" style={{ fontFamily: "Orbitron,sans-serif" }}>{s.step}</span>
                  </div>
                  <div className="flex-1 cyber-card p-5 flex items-start gap-4">
                    <Icon className="w-5 h-5 text-cyan-neon flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-white mb-1">{s.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>
              Trusted by <span className="text-neon-magenta">Operations Teams</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="cyber-card p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm text-white/80 leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "rgba(0,240,255,0.12)", border: "1px solid rgba(0,240,255,0.2)", color: "#00f0ff" }}>{t.avatar}</div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/50">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>
              Simple <span className="text-neon-cyan">Credit-Based</span> Pricing
            </h2>
            <p className="text-white/60">Pay only when you train. No subscriptions. Credits never expire.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PRICING.map((p) => (
              <div key={p.name} className={`cyber-card p-7 relative ${p.highlight ? "border-cyan-neon/40" : ""}`}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold" style={{ background: "#00f0ff", color: "#0a0a0a", fontFamily: "Orbitron,sans-serif" }}>POPULAR</div>
                )}
                <div className="mb-6">
                  <div className="text-sm font-mono text-white/60 uppercase tracking-widest mb-2">{p.name}</div>
                  <div className="text-4xl font-bold text-white mb-0.5" style={{ fontFamily: "Orbitron,sans-serif" }}>{p.price}</div>
                  <div className="text-xs text-white/40 font-mono">{p.period} · {p.credits}</div>
                  <div className="text-sm text-white/60 mt-2">{p.desc}</div>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle className="w-4 h-4 text-cyan-neon flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <SignUpButton mode="modal">
                  <button className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${p.highlight ? "btn-neon" : "btn-secondary"}`}>
                    {p.cta}
                  </button>
                </SignUpButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="cyber-card p-12" style={{ borderColor: "rgba(0,240,255,0.2)" }}>
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Orbitron,sans-serif" }}>
              Ready to Build Your<br /><span className="text-neon-cyan">Logistics Brain?</span>
            </h2>
            <p className="text-white/60 mb-8">Start with 100 free credits. Train your first model in under an hour.</p>
            <SignUpButton mode="modal">
              <button className="btn-neon text-base px-10 py-4 rounded-xl font-bold">
                Get Started Free →
              </button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg border border-cyan-neon/50 flex items-center justify-center" style={{ background: "rgba(0,240,255,0.06)" }}>
              <span className="font-bold text-cyan-neon text-xs" style={{ fontFamily: "Orbitron,sans-serif" }}>NF</span>
            </div>
            <span className="text-white/60 text-sm">NeuroFast Technologies</span>
          </div>
          <p className="text-white/30 text-xs font-mono">© 2026 NeuroFast · Made in India 🇮🇳 · support@neurofast.in</p>
          <div className="flex items-center gap-6 text-xs text-white/40">
            <Link href="/terms" className="hover:text-white/70 transition-colors">Privacy & Terms</Link>
            <Link href="/demo" className="hover:text-white/70 transition-colors text-cyan-neon/60 hover:text-cyan-neon">Try Demo</Link>
            <a href="mailto:support@neurofast.in" className="hover:text-white/70 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
