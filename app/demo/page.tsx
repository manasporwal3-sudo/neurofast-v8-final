// app/demo/page.tsx — NeuroFast Demo Page v6
"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Brain, Zap, BarChart3, ArrowRight, Bot, User, Send, CheckCircle, X, Sparkles } from "lucide-react";

const DEMO_MSG_LIMIT = 5;

const AI_RESPONSES: Record<string, string[]> = {
  sku: [
    "Based on historical demand patterns, these SKUs are at stockout risk this week:\n\n• SKU-482 (Tomatoes) — 89% probability. Reorder 200 units.\n• SKU-156 (Onions) — 76% risk. Stock covers only 2.3 days.\n• SKU-901 (Cooking Oil) — Diwali surge detected. Pre-order 150 units.\n\nWould you like me to generate a purchase order?",
    "Your top revenue-losing stockouts last week:\n\n1. Dairy — ₹4,200 lost\n2. Fresh produce — ₹3,800 lost\n3. Beverages — ₹2,100 lost\n\nI recommend increasing reorder frequency for categories with >70% weekly velocity variance.",
  ],
  route: [
    "Optimized route for 8 Bangalore orders:\n\nWarehouse → Koramangala → Indiranagar → HSR Layout → BTM → Jayanagar → JP Nagar → Banashankari → Warehouse\n\n42 km · 2.8 hrs · ₹380 fuel — saves 12 km vs current route.",
    "Traffic alert on ORR detected. 3 deliveries rerouted:\n\n• Driver D-04: via Bellandur — ETA maintained\n• Driver D-07: via Sarjapur — saves 18 minutes\n• Driver D-11: Minor delay — customer auto-notified",
  ],
  default: [
    "I'm your custom-trained NeuroFast AI for logistics. I can help with inventory forecasting, route optimization, demand prediction, and ops analytics. What would you like to know?",
    "As your fine-tuned assistant, I have deep knowledge of your specific business context — patterns generic AI models miss. Ask me about SKUs, delivery zones, or demand forecasts.",
    "My accuracy improves with more training data. I can learn your vendor relationships, seasonal patterns, and customer preferences. Try asking something specific!",
  ],
};

function getAIResponse(msg: string): string {
  const lower = msg.toLowerCase();
  if (["sku","stock","inventory","reorder","demand","forecast","stockout"].some((k) => lower.includes(k)))
    return AI_RESPONSES.sku[Math.floor(Math.random() * AI_RESPONSES.sku.length)];
  if (["route","delivery","driver","optimize","bangalore","fleet"].some((k) => lower.includes(k)))
    return AI_RESPONSES.route[Math.floor(Math.random() * AI_RESPONSES.route.length)];
  return AI_RESPONSES.default[Math.floor(Math.random() * AI_RESPONSES.default.length)];
}

function ConversionModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="cyber-card p-8 max-w-md w-full mx-4 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl border border-cyan-neon/40 bg-cyan-neon/8 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-cyan-neon" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">Create Your <span className="text-cyan-neon">AI</span> to Continue</h2>
          <p className="font-body text-sm text-muted-foreground">Build your own custom AI trained on your logistics data.</p>
        </div>
        <div className="space-y-3 mb-6">
          {["Train on your own inventory data","Unlimited conversations","Custom SKU and route intelligence","API access for automation"].map((f) => (
            <div key={f} className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="font-body text-white/80">{f}</span>
            </div>
          ))}
        </div>
        <Link href="/sign-up" className="block w-full btn-neon py-3 rounded-lg text-center font-display text-sm font-bold">
          START FREE — No Credit Card →
        </Link>
        <p className="text-center font-mono text-[11px] text-muted-foreground mt-3">
          Already have an account? <Link href="/sign-in" className="text-cyan-neon hover:opacity-80">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [step, setStep] = useState<"entry"|"chat"|"train">("entry");
  const [messages, setMessages] = useState<Array<{role:"user"|"assistant";content:string;ts:number}>>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [showConversion, setShowConversion] = useState(false);
  const [trainSimStep, setTrainSimStep] = useState(0);
  const [trainDone, setTrainDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  useEffect(() => {
    if (step !== "train" || trainDone) return;
    const steps = ["Validating dataset...","Tokenizing 1,247 samples...","Initializing LoRA adapter (rank=8)...","Epoch 1/3 — loss: 2.41","Epoch 2/3 — loss: 1.87","Epoch 3/3 — loss: 1.23","Saving model weights...","✓ Training complete!"];
    let i = 0;
    const interval = setInterval(() => { setTrainSimStep(++i); if (i >= steps.length) { clearInterval(interval); setTrainDone(true); } }, 900);
    return () => clearInterval(interval);
  }, [step, trainDone]);

  const sendMessage = async () => {
    if (!input.trim() || typing) return;
    if (msgCount >= DEMO_MSG_LIMIT) { setShowConversion(true); return; }
    const userMsg = { role: "user" as const, content: input, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput(""); setTyping(true);
    const next = msgCount + 1;
    setMsgCount(next);
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    setMessages((m) => [...m, { role: "assistant", content: getAIResponse(userMsg.content), ts: Date.now() }]);
    setTyping(false);
    if (next >= DEMO_MSG_LIMIT) setTimeout(() => setShowConversion(true), 1500);
  };

  if (step === "entry") return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="bg-cyan-neon/10 border-b border-cyan-neon/20 py-2 px-4 text-center">
        <span className="font-mono text-xs text-cyan-neon">🧪 DEMO MODE — No account required · Try instantly</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-neon/20 bg-cyan-neon/5 text-cyan-neon font-mono text-xs mb-8">
            <Sparkles className="w-3.5 h-3.5" /> Live Demo — Instant Access
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Try Your Own <span className="gradient-text">Logistics AI</span><br />in 30 Seconds
          </h1>
          <p className="font-body text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            See how a fine-tuned AI trained on your data outperforms generic ChatGPT for inventory, routing, and demand.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-10 stagger">
            {[
              {icon:Brain,  label:"SKU Forecast",    sub:"Predict stockouts",   c:"cyan"},
              {icon:Zap,    label:"Route Optimizer",  sub:"Last-mile routing",   c:"magenta"},
              {icon:BarChart3,label:"Demand Analytics",sub:"Seasonal patterns", c:"cyan"},
            ].map((b) => (
              <div key={b.label} className="cyber-card p-4 text-center animate-fade-up hover:scale-[1.02] transition-transform">
                <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center ${b.c==="cyan"?"bg-cyan-neon/8 border border-cyan-neon/15":"bg-magenta-neon/8 border border-magenta-neon/15"}`}>
                  <b.icon className={`w-5 h-5 ${b.c==="cyan"?"text-cyan-neon":"text-magenta-neon"}`} />
                </div>
                <p className="font-display text-xs font-bold text-white mb-0.5">{b.label}</p>
                <p className="font-mono text-[10px] text-white/40">{b.sub}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => setStep("chat")} className="btn-neon px-8 py-3.5 rounded-xl font-display text-base font-bold flex items-center gap-2 justify-center">
              Try the AI Chat <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => setStep("train")} className="px-8 py-3.5 rounded-xl font-display text-base font-bold border border-white/10 text-white/70 hover:text-white flex items-center gap-2 justify-center transition-all">
              Simulate Training <Zap className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            Want the real thing? <Link href="/sign-up" className="text-cyan-neon hover:opacity-80">Create free account →</Link>
          </p>
        </div>
      </div>
    </div>
  );

  if (step === "train") {
    const STEPS = ["Validating dataset...","Tokenizing 1,247 samples...","Initializing LoRA adapter (rank=8)...","Epoch 1/3 — loss: 2.41","Epoch 2/3 — loss: 1.87","Epoch 3/3 — loss: 1.23","Saving model weights...","✓ Training complete!"];
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <div className="bg-cyan-neon/10 border-b border-cyan-neon/20 py-2 px-4 flex items-center justify-between">
          <span className="font-mono text-xs text-cyan-neon">🧪 DEMO MODE — Training Simulation</span>
          <button onClick={() => setStep("entry")} className="font-mono text-xs text-muted-foreground hover:text-white">← Back</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <Zap className="w-10 h-10 text-magenta-neon mx-auto mb-3" />
              <h2 className="font-display text-2xl font-bold text-white">Training Simulation</h2>
              <p className="font-body text-sm text-muted-foreground mt-1">See how your AI model trains on real data</p>
            </div>
            <div className="cyber-card p-4 mb-6 space-y-2.5 text-xs">
              {[["Dataset","demo-logistics-data.jsonl"],["Base Model","Llama-3.1-8B-Instruct"],["Method","LoRA · rank=8 · 3 epochs"]].map(([k,v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="font-mono text-muted-foreground">{k}</span>
                  <span className="font-mono text-cyan-neon">{v}</span>
                </div>
              ))}
            </div>
            <div className="cyber-card p-4 font-mono text-xs">
              <div className="text-muted-foreground mb-3 text-[10px] uppercase tracking-wider">Training Log</div>
              <div className="space-y-1.5">
                {STEPS.map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 transition-all duration-300 ${i < trainSimStep ? "opacity-100" : "opacity-20"}`}>
                    <span className={i < trainSimStep ? "text-green-400" : i === trainSimStep ? "text-cyan-neon animate-pulse" : "text-white/20"}>
                      {i < trainSimStep ? "✓" : i === trainSimStep ? "▸" : "○"}
                    </span>
                    <span className={i === 7 && trainDone ? "text-green-400" : "text-white/70"}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-neon to-magenta-neon transition-all duration-700" style={{ width: `${(trainSimStep/STEPS.length)*100}%` }} />
              </div>
            </div>
            {trainDone && (
              <div className="mt-6 space-y-3">
                <button onClick={() => setStep("chat")} className="w-full btn-neon py-3 rounded-xl font-display text-sm font-bold">Chat With Your Model →</button>
                <Link href="/sign-up" className="block w-full text-center py-3 rounded-xl font-display text-sm border border-white/10 text-white/70 hover:text-white transition-all">Create Real Account — Free</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chat step
  return (
    <>
      {showConversion && <ConversionModal onClose={() => setShowConversion(false)} />}
      <div className="h-screen bg-[#0a0a0a] text-white flex flex-col">
        <div className="bg-cyan-neon/10 border-b border-cyan-neon/20 py-2 px-4 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-xs text-cyan-neon">🧪 DEMO MODE — Demo Logistics AI</span>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted-foreground">{DEMO_MSG_LIMIT - msgCount} messages left</span>
            <button onClick={() => setStep("entry")} className="font-mono text-xs text-muted-foreground hover:text-white">← Back</button>
          </div>
        </div>
        <div className="h-0.5 bg-white/5 flex-shrink-0">
          <div className="h-full bg-gradient-to-r from-cyan-neon to-magenta-neon transition-all duration-500" style={{ width: `${(msgCount/DEMO_MSG_LIMIT)*100}%` }} />
        </div>
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg border border-cyan-neon/30 bg-cyan-neon/8 flex items-center justify-center">
            <Brain className="w-4 h-4 text-cyan-neon" />
          </div>
          <div>
            <div className="font-display text-sm font-bold text-white">Demo Logistics AI</div>
            <div className="font-mono text-[10px] text-muted-foreground">Llama-3.1-8B · Demo · not your real trained model</div>
          </div>
          <div className="ml-auto">
            <Link href="/sign-up" className="btn-neon px-4 py-1.5 rounded-lg text-xs font-display font-bold">Train Your Own →</Link>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-12 h-12 text-cyan-neon mx-auto mb-4 opacity-50" />
              <p className="font-body text-sm text-muted-foreground mb-6">Ask anything about logistics, inventory, or routing.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["What SKUs might stock out?","Optimize 8 orders in Bangalore","Analyze Diwali demand"].map((p) => (
                  <button key={p} onClick={() => setInput(p)} className="px-3 py-1.5 rounded-full border border-white/10 text-white/60 hover:text-white font-mono text-xs transition-all">{p}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role==="user"?"justify-end":"justify-start"}`}>
              {msg.role==="assistant" && <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"rgba(0,240,255,0.1)",border:"1px solid rgba(0,240,255,0.2)"}}><Bot className="w-4 h-4 text-cyan-neon"/></div>}
              <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap font-sans"
                style={msg.role==="user"?{background:"rgba(255,0,170,0.12)",border:"1px solid rgba(255,0,170,0.18)"}:{background:"rgba(13,13,26,0.9)",border:"1px solid rgba(255,255,255,0.07)"}}>
                {msg.content}
              </div>
              {msg.role==="user" && <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"rgba(255,0,170,0.1)",border:"1px solid rgba(255,0,170,0.2)"}}><User className="w-4 h-4 text-magenta-neon"/></div>}
            </div>
          ))}
          {typing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"rgba(0,240,255,0.1)",border:"1px solid rgba(0,240,255,0.2)"}}><Bot className="w-4 h-4 text-cyan-neon"/></div>
              <div className="rounded-2xl px-4 py-3" style={{background:"rgba(13,13,26,0.9)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div className="flex gap-1 items-center h-5">
                  {[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-neon/60 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div className="p-4 border-t border-white/5 flex-shrink-0">
          {msgCount >= DEMO_MSG_LIMIT ? (
            <div className="text-center py-2">
              <p className="font-mono text-xs text-muted-foreground mb-3">Demo limit reached.</p>
              <Link href="/sign-up" className="btn-neon px-6 py-2.5 rounded-xl font-display text-sm font-bold">Create Free Account to Continue →</Link>
            </div>
          ) : (
            <div className="flex gap-3">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key==="Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about your logistics, inventory, or routes…"
                className="flex-1 bg-void-500 border border-white/10 rounded-xl px-4 py-3 font-body text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-neon/40 transition-colors"
                autoFocus />
              <button onClick={sendMessage} disabled={!input.trim()||typing}
                className="w-12 h-12 rounded-xl btn-neon flex items-center justify-center disabled:opacity-40 transition-all active:scale-95">
                <Send className="w-4 h-4"/>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
