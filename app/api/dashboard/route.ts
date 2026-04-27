// app/api/dashboard/route.ts
// GET: All user dashboard data in one request — real DB queries only
//
// CHANGES v5:
//   - Redis cache (TTL 30s) — avoids repeated parallel DB queries on every page load
//   - Cache invalidated by train/route.ts and ai-brain on job/credit changes
//   - Standardized response format: { success, data, error, meta }

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  trainingJobs, fineTunedModels, creditTransactions, aiCostLogs, datasets,
} from "@/lib/db/schema";
import { eq, desc, gte, count, sum, and, inArray } from "drizzle-orm";
import { withSentry } from "@/lib/services/sentry";
import { getCachedDashboard, cacheDashboard } from "@/lib/cache/redis";

async function handler(req: NextRequest): Promise<NextResponse> {
  const user = await getUserForApi();
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: "Session expired — please sign in again." }, { status: 401 });
  }

  // v5: Check Redis cache first (30s TTL)
  const cached = await getCachedDashboard(user.id);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, error: null, meta: { cached: true } });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    recentJobsRows,
    modelsRows,
    recentCreditsRows,
    activeJobCountRows,
    totalTokensRows,
    datasetsRows,
  ] = await Promise.all([
    db.select().from(trainingJobs)
      .where(eq(trainingJobs.userId, user.id))
      .orderBy(desc(trainingJobs.createdAt))
      .limit(5),

    db.select().from(fineTunedModels)
      .where(eq(fineTunedModels.userId, user.id))
      .orderBy(desc(fineTunedModels.createdAt))
      .limit(6),

    db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, user.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(15),

    db.select({ n: count() }).from(trainingJobs)
      .where(and(
        eq(trainingJobs.userId, user.id),
        inArray(trainingJobs.status, ["running", "queued", "pending"])
      )),

    db.select({ total: sum(aiCostLogs.totalTokens), cost: sum(aiCostLogs.costUsd) })
      .from(aiCostLogs)
      .where(and(eq(aiCostLogs.userId, user.id), gte(aiCostLogs.createdAt, thirtyDaysAgo))),

    db.select({ n: count() }).from(datasets).where(eq(datasets.userId, user.id)),
  ]);

  const creditsByDay = recentCreditsRows
    .filter((t) => t.amount < 0)
    .reduce((acc, tx) => {
      const day = new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      acc[day] = (acc[day] ?? 0) + Math.abs(tx.amount);
      return acc;
    }, {} as Record<string, number>);

  const responseData = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      creditsBalance: user.creditsBalance,
      totalJobsRun: user.totalJobsRun,
      monthlyJobsUsed: user.monthlyJobsUsed,
    },
    stats: {
      activeJobs: activeJobCountRows[0]?.n ?? 0,
      totalModels: modelsRows.filter((m) => m.status === "active").length,
      totalJobsRun: user.totalJobsRun,
      tokensUsed30d: parseInt(String(totalTokensRows[0]?.total ?? "0")),
      costUsd30d: parseFloat(String(totalTokensRows[0]?.cost ?? "0")),
      totalDatasets: datasetsRows[0]?.n ?? 0,
    },
    recentJobs: recentJobsRows.map((j) => ({
      id: j.id,
      togetherJobId: j.togetherJobId,
      modelSuffix: j.modelSuffix,
      baseModel: j.baseModel.split("/")[1] ?? j.baseModel,
      status: j.status,
      progressPercent: j.progressPercent,
      createdAt: j.createdAt,
      fineTunedModelId: j.fineTunedModelId,
    })),
    models: modelsRows.map((m) => ({
      id: m.id,
      name: m.name,
      baseModel: m.baseModel.split("/")[1] ?? m.baseModel,
      status: m.status,
      totalChats: m.totalChats,
      createdAt: m.createdAt,
    })),
    creditActivity: recentCreditsRows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      createdAt: t.createdAt,
    })),
    usageChart: Object.entries(creditsByDay).map(([date, credits]) => ({ date, credits })),
    generatedAt: new Date().toISOString(),
  };

  // v5: Store in Redis cache (30s TTL)
  await cacheDashboard(user.id, responseData);

  return NextResponse.json({
    success: true,
    data: responseData,
    error: null,
    meta: { cached: false },
  });
}

export const GET = withSentry(handler);
