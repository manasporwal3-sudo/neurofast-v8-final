// components/playground/ChatPlayground.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { FineTunedModel } from "@/lib/db/schema";
import { Send, Download, Share2, RotateCcw, Bot, User, Zap, Copy, CheckCheck, AlertTriangle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
  tokens?: number;
}

interface Props {
  model: FineTunedModel;
  userId: string;
}

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex gap-3 animate-fade-up ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)" }}>
          <Bot className="w-4 h-4 text-cyan-neon" />
        </div>
      )}
      <div className={`group max-w-[78%] relative`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "text-white" : "text-white/90"}`}
          style={isUser ? { background: "rgba(255,0,170,0.12)", border: "1px solid rgba(255,0,170,0.18)" } : { background: "rgba(13,13,26,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
        </div>
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="font-mono text-[10px] text-white/25">{new Date(msg.ts).toLocaleTimeString()}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {msg.tokens && <span className="font-mono text-[10px] text-white/25">{msg.tokens}t</span>}
            <button onClick={copy} className="p-1 rounded text-white/30 hover:text-white transition-colors">
              {copied ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(255,0,170,0.1)", border: "1px solid rgba(255,0,170,0.2)" }}>
          <User className="w-4 h-4 text-magenta-neon" />
        </div>
      )}
    </div>
  );
}

const STARTER_PROMPTS = [
  "What SKUs are likely to stock out this week?",
  "Optimize an 8-order delivery route in Bangalore",
  "Analyze my Diwali demand forecast",
  "What are my top 5 revenue-losing stockouts?",
];

export default function ChatPlayground({ model, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState("");
  const [totalTokens, setTotalTokens] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStream]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    setError(null);
    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setCurrentStream("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/chat/${model.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })) }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string }; usage?: { completion_tokens?: number } }> };
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            fullText += delta;
            tokenCount += Math.ceil(delta.length / 4);
            setCurrentStream(fullText);
          } catch { /* skip malformed */ }
        }
      }

      setTotalTokens(t => t + tokenCount + Math.ceil(text.length / 4));
      setMessages(prev => [...prev, { role: "assistant", content: fullText, ts: Date.now(), tokens: tokenCount }]);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = err instanceof Error ? err.message : "Request failed";
        setError(msg);
        setRetryMsg(text); // v6: store for retry button
        toast.error(msg);
      }
    } finally {
      setStreaming(false);
      setCurrentStream("");
    }
  }, [input, streaming, messages, model.id]);

  const stop = () => { abortRef.current?.abort(); };

  const clear = () => {
    setMessages([]);
    setTotalTokens(0);
    setError(null);
    setInput("");
  };

  const exportChat = () => {
    const blob = new Blob([JSON.stringify({ model: model.name, messages }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${model.name}-chat-${Date.now()}.json` }).click();
    toast.success("Chat exported");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)" }}>
            <Bot className="w-5 h-5 text-cyan-neon" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{model.name}</div>
            <div className="font-mono text-[10px] text-white/40">{model.baseModel.split("/")[1]} · {messages.length} messages · {totalTokens} tokens</div>
          </div>
          <span className="status-running text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-neon animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={clear} className="btn-icon" title="Clear chat"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={exportChat} className="btn-icon" title="Export JSON"><Download className="w-4 h-4" /></button>
          <button onClick={copyLink} className="btn-icon" title="Copy link"><Share2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-5 space-y-4 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="empty-state">
            <div className="empty-state-icon animate-float">
              <Bot className="w-8 h-8 text-cyan-neon/60" />
            </div>
            <h3 className="empty-state-title">{model.name} is ready</h3>
            <p className="empty-state-desc">
              {model.systemPrompt ? `"${model.systemPrompt.slice(0, 100)}..."` : "Ask a logistics question to get started."}
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm mt-2">
              {STARTER_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  className="text-left text-xs p-3 rounded-xl border border-white/8 text-white/50 hover:text-white hover:border-white/15 transition-all leading-relaxed">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {/* Streaming */}
        {streaming && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)" }}>
              <Bot className="w-4 h-4 text-cyan-neon animate-pulse" />
            </div>
            <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm text-white/90" style={{ background: "rgba(13,13,26,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {currentStream || <span className="text-white/40">Thinking</span>}
              <span className="cursor-blink" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl animate-fade-in" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
                {retryMsg && (
                  <button
                    onClick={() => { setError(null); sendMessage(retryMsg); setRetryMsg(null); }}
                    className="flex items-center gap-1 text-[11px] font-mono text-white/50 hover:text-white border border-white/10 px-2 py-0.5 rounded transition-all hover:border-white/25"
                  >
                    ↺ Retry
                  </button>
                )}
                <button onClick={() => { setError(null); setRetryMsg(null); }} className="text-xs text-red-400/60 hover:text-red-400 font-mono">dismiss</button>
              </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-4 border-t border-white/5">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Message ${model.name}… (Enter to send, Shift+Enter for newline)`}
              rows={1}
              disabled={streaming}
              className="input textarea text-sm pr-4 leading-relaxed"
              style={{ minHeight: "46px", maxHeight: "140px", resize: "none" }}
            />
          </div>
          {streaming ? (
            <button onClick={stop} className="btn-danger px-4 rounded-xl flex-shrink-0">
              Stop
            </button>
          ) : (
            <button onClick={() => sendMessage()} disabled={!input.trim()}
              className="btn-neon px-4 rounded-xl flex-shrink-0 disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/25">
            <Zap className="w-3 h-3" />
            {totalTokens} tokens used this session
          </div>
          <span className="font-mono text-[10px] text-white/25">
            {streaming ? <span className="text-cyan-neon animate-pulse">GENERATING…</span> : "READY"}
          </span>
        </div>
      </div>
    </div>
  );
}
