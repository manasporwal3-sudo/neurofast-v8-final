// app/api/admin/config/route.ts
// GET:   Read all system config values
// PATCH: Update one or more config values
// Protected: admin role only

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { setConfig, seedDefaultConfig } from "@/lib/services/config";
import { auditInfo } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { BulkUpdateConfigSchema } from "@/lib/schemas";
import { asc } from "drizzle-orm";

// GET — list all config values grouped by category
async function getHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  // Seed defaults if DB is empty
  await seedDefaultConfig();

  const configs = await db
    .select()
    .from(systemConfig)
    .orderBy(asc(systemConfig.category), asc(systemConfig.key));

  // Group by category
  const grouped = configs.reduce(
    (acc, c) => {
      const cat = c.category ?? "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(c);
      return acc;
    },
    {} as Record<string, typeof configs>
  );

  await auditInfo({
    userId: adminResult.id,
    actorEmail: adminResult.email,
    action: "admin.config_read",
    resource: "system_config",
    metadata: { configCount: configs.length },
    req,
  });

  return NextResponse.json({ grouped, total: configs.length });
}

// PATCH — bulk update config values
async function patchHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as unknown;
  const parsed = BulkUpdateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const results: Array<{ key: string; success: boolean; error?: string }> = [];

  for (const update of parsed.data.updates) {
    try {
      await setConfig(update.key, update.value, adminResult.email);
      results.push({ key: update.key, success: true });
    } catch (err) {
      results.push({ key: update.key, success: false, error: String(err) });
    }
  }

  await auditInfo({
    userId: adminResult.id,
    actorEmail: adminResult.email,
    action: "admin.config_update",
    resource: "system_config",
    metadata: {
      updatedKeys: parsed.data.updates.map((u) => u.key),
      results,
    },
    severity: "warn",
    req,
  });

  return NextResponse.json({ results });
}

export const GET = withSentry(getHandler);
export const PATCH = withSentry(patchHandler);
