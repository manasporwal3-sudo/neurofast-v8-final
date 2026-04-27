// app/sign-up/[[...sign-up]]/page.tsx — v6: Added terms link + demo link
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-void-black grid-overlay flex items-center justify-center relative">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(255,0,170,0.06) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 text-center">
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded border border-cyan-neon/50 flex items-center justify-center shadow-neon-sm">
              <span className="font-display font-bold text-cyan-neon text-xs">NF</span>
            </div>
            <span className="font-display text-white font-semibold tracking-wider">
              NEUROFAST <span className="text-cyan-neon">AI</span>
            </span>
          </div>
          <p className="font-mono text-xs text-cyan-neon/60">100 FREE CREDITS ON SIGNUP</p>
        </div>
        <SignUp />
        {/* Terms link below sign-up widget */}
        <p className="font-mono text-[11px] text-muted-foreground mt-5">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="text-cyan-neon hover:opacity-80 underline underline-offset-2">
            Terms & Conditions
          </Link>
          .{" "}
          <Link href="/demo" className="text-white/40 hover:text-white transition-colors">
            Try demo first →
          </Link>
        </p>
      </div>
    </div>
  );
}
