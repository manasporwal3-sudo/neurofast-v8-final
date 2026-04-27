// app/(app)/models/[id]/edit/page.tsx
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fineTunedModels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import ModelEditor from "@/components/models/ModelEditor";

export default async function ModelEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [model] = await db
    .select()
    .from(fineTunedModels)
    .where(and(eq(fineTunedModels.id, id), eq(fineTunedModels.userId, user.id)));

  if (!model) notFound();

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground mb-1">
          <a href="/models" className="hover:text-cyan-neon">models</a>
          <span>/</span>
          <span className="text-cyan-neon">{model.name}</span>
          <span>/</span>
          <span>edit</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          EDIT <span className="text-magenta-neon">{model.name.toUpperCase()}</span>
        </h1>
      </div>
      <ModelEditor model={model} />
    </div>
  );
}
