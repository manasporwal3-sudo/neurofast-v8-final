// components/onboarding/OnboardingFlow.tsx
// Shown after first signup — guides user through Upload → Train → Chat
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Upload, Zap, MessageSquare, CheckCircle, ArrowRight, X } from "lucide-react";

interface OnboardingFlowProps {
  onDismiss?: () => void;
}

const STEPS = [
  {
    id: "upload",
    icon: Upload,
    title: "Upload your logistics data",
    desc: "Upload a JSONL/CSV file with your operational Q&A, or choose one of our 4 pre-built logistics templates to get started instantly.",
    cta: "Upload Dataset",
    href: "/train",
    tip: "💡 Start with the Dark Store SKU template — it has 150+ real logistics examples ready to use.",
  },
  {
    id: "train",
    icon: Zap,
    title: "Train your first model",
    desc: "Select a base model (8B is great for most tasks), configure settings, and launch. Training takes 30–60 minutes via Together AI.",
    cta: "Start Training",
    href: "/train",
    tip: "💡 Use LoRA rank 8 and 3 epochs for your first run — the defaults work well for logistics tasks.",
  },
  {
    id: "chat",
    icon: MessageSquare,
    title: "Chat with your model",
    desc: "Once training completes, your model appears in Playground. Ask it logistics questions specific to your operation.",
    cta: "Open Playground",
    href: "/playground",
    tip: "💡 Try: \"What SKUs are likely to stock out this week?\" or \"Optimize this 8-order delivery route.\"",
  },
];

const STORAGE_KEY = "nf_onboarding_dismissed";

export default function OnboardingFlow({ onDismiss }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="cyber-card p-6 mb-6 animate-fade-up" style={{ borderColor: "rgba(0,240,255,0.2)", borderWidth: "1px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-neon mb-0.5">Getting Started</div>
          <h2 className="font-bold text-white text-base" style={{ fontFamily: "Orbitron,sans-serif" }}>
            Set up your logistics AI in 3 steps
          </h2>
        </div>
        <button onClick={dismiss} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <button
              onClick={() => setCurrentStep(i)}
              className={`step-circle flex-shrink-0 ${i < currentStep ? "done" : i === currentStep ? "active" : ""}`}
            >
              {i < currentStep ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`step-line ${i < currentStep ? "active" : ""}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex items-start gap-5 animate-fade-in" key={currentStep}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)" }}>
          <Icon className="w-5 h-5 text-cyan-neon" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white mb-1.5 text-sm">{step.title}</h3>
          <p className="text-sm text-white/60 leading-relaxed mb-3">{step.desc}</p>
          <div className="text-xs text-white/40 bg-white/3 rounded-lg px-3 py-2 border border-white/5 mb-4 leading-relaxed">
            {step.tip}
          </div>
          <div className="flex items-center gap-3">
            <Link href={step.href} className="btn-neon text-xs px-4 py-2 rounded-lg flex items-center gap-2">
              {step.cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {!isLast && (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="text-xs text-white/40 hover:text-white transition-colors font-mono"
              >
                Skip step →
              </button>
            )}
            {isLast && (
              <button
                onClick={dismiss}
                className="text-xs text-white/40 hover:text-white transition-colors font-mono"
              >
                I&apos;ve got it →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="font-mono text-[10px] text-white/30">Step {currentStep + 1} of {STEPS.length}</span>
        <button onClick={dismiss} className="font-mono text-[10px] text-white/25 hover:text-white/50 transition-colors">
          Dismiss guide
        </button>
      </div>
    </div>
  );
}
