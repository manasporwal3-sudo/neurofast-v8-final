// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-void-black grid-overlay flex items-center justify-center relative">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(0,240,255,0.08) 0%, transparent 70%)" }}
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
          <p className="font-mono text-xs text-muted-foreground">SOVEREIGN LOGISTICS INTELLIGENCE</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
