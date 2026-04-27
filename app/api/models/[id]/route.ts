// app/api/models/[id]/route.ts
// GET, PATCH, DELETE for individual fine-tuned models
//
// UPGRADE LOG (v2):
//   + withSentry() on PATCH and DELETE
//   + auditInfo()  on PATCH (model.edit) and DELETE (model.delete)
//   Existing CRUD logic: unchanged

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { fineTunedModels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auditInfo } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { PatchModelSchema } from "@/lib/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  const [model] = await db
    .select()
    .from(fineTunedModels)
    .where(and(eq(fineTunedModels.id, id), eq(fineTunedModels.userId, user.id)));

  if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(model);
}

async function patchHandler(
  req: NextRequest,
  context?: unknown
): Promise<NextResponse> {
  const { id } = (context as { params: { id: string } }).params;
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  const body = await req.json() as unknown;
  const parsed = PatchModelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [updated] = await db
    .update(fineTunedModels)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(fineTunedModels.id, id), eq(fineTunedModels.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "model.edit",
    resource: "fine_tuned_model",
    resourceId: id,
    metadata: { fields: Object.keys(parsed.data) },
    req,
  });

  return NextResponse.json(updated);
}

async function deleteHandler(
  req: NextRequest,
  context?: unknown
): Promise<NextResponse> {
  const { id } = (context as { params: { id: string } }).params;
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  await db
    .update(fineTunedModels)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(and(eq(fineTunedModels.id, id), eq(fineTunedModels.userId, user.id)));

  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "model.delete",
    resource: "fine_tuned_model",
    resourceId: id,
    metadata: {},
    severity: "warn",
    req,
  });

  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return withSentry(patchHandler)(req, { params });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return withSentry(deleteHandler)(req, { params });
}
