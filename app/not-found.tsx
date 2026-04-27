// app/not-found.tsx — v7 POLISH
import Link from "next/link";
import { Brain, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0a" }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, rgba(0,240,255,0.12) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 text-center max-w-md animate-fade-up">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl border border-cyan-neon/20 bg-cyan-neon/5 flex items-center justify-center mx-auto mb-6 animate-float">
          <Brain className="w-10 h-10 text-cyan-neon/50" />
        </div>

        {/* Code */}
        <div className="font-mono text-7xl font-bold text-white/8 mb-2 select-none">404</div>

        {/* Heading */}
        <h1 className="font-display text-2xl font-bold text-white mb-3">
          PAGE NOT <span className="text-cyan-neon">FOUND</span>
        </h1>

        {/* Message */}
        <p className="font-body text-base text-white/45 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="btn-neon px-6 py-2.5 rounded-xl flex items-center gap-2">
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link href="/" className="btn-secondary px-6 py-2.5 rounded-xl flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        {/* Decorative scan line */}
        <div className="mt-10 h-px bg-gradient-to-r from-transparent via-cyan-neon/20 to-transparent" />
        <p className="font-mono text-[10px] text-white/20 mt-4 uppercase tracking-widest">
          NEUROFAST AI · Error 404
        </p>
      </div>
    </div>
  );
}
