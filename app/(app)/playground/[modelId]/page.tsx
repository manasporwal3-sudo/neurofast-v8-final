// app/(app)/playground/[modelId]/page.tsx
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fineTunedModels } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ChatPlayground from "@/components/playground/ChatPlayground";

export default async function PlaygroundPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = await params;
  const user = await requireUser();

  const [model] = await db
    .select()
    .from(fineTunedModels)
    .where(eq(fineTunedModels.id, modelId));

  if (!model) notFound();

  // Verify ownership (or public model)
  if (model.userId !== user.id && !model.isPublic) notFound();

  return <ChatPlayground model={model} userId={user.id} />;
}
