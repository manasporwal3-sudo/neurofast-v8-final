// app/(app)/train/page.tsx
import { requireUser } from "@/lib/auth";
import TrainStepper from "@/components/training/TrainStepper";
import { Suspense } from "react";

export default async function TrainPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          TRAIN <span className="text-cyan-neon">NEW MODEL</span>
        </h1>
        <p className="font-body text-muted-foreground mt-1">
          Upload your logistics data and fine-tune a private AI model in 4 steps.
        </p>
      </div>

      <Suspense fallback={<div className="font-mono text-xs text-cyan-neon animate-pulse">INITIALIZING TRAINER...</div>}>
        <TrainStepper user={user} />
      </Suspense>
    </div>
  );
}
