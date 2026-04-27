// app/api/admin/analytics/route.ts
// GET: Real-time platform analytics — all data from DB + BullMQ, zero mocks

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users, trainingJobs, payments, aiCostLogs,
  auditLogs, creditTransactions, fineTunedModels,
} from "@/lib/db/schema";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { getQueueStats } from "@/lib/queue/client";
import { withSentry } from "@/lib/services/sentry";
import { desc, count, sum, gte, eq, and, sql } from "drizzle-orm";

async function handler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") ?? "30")));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalUsersRows, newUsersRows,
    totalRevenueRows, recentRevenueRows,
    totalAiCostRows, costByModelRows,
    totalJobRows, completedJobRows, failedJobRows, runningJobRows,
    totalModelsRows,
    creditPurchasedRows, creditSpentRows,
    errorCountRows,
    topJobUsersRows,
    dailyUsersRows, dailyRevenueRows,
    recentAuditRows,
    queueStats,
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, since)),
    db.select({ total: sum(payments.amount) }).from(payments).where(eq(payments.status, "paid")),
    db.select({ total: sum(payments.amount) }).from(payments).where(and(eq(payments.status, "paid"), gte(payments.createdAt, since))),
    db.select({ total: sum(aiCostLogs.costUsd) }).from(aiCostLogs),
    db.select({ model: aiCostLogs.model, callType: aiCostLogs.callType, costUsd: sum(aiCostLogs.costUsd), tokens: sum(aiCostLogs.totalTokens), calls: count() }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(aiCostLogs.model, aiCostLogs.callType).orderBy(desc(sum(aiCostLogs.costUsd))).limit(10),
    db.select({ n: count() }).from(trainingJobs),
    db.select({ n: count() }).from(trainingJobs).where(and(eq(trainingJobs.status, "completed"), gte(trainingJobs.createdAt, since))),
    db.select({ n: count() }).from(trainingJobs).where(and(eq(trainingJobs.status, "failed"), gte(trainingJobs.createdAt, since))),
    db.select({ n: count() }).from(trainingJobs).where(eq(trainingJobs.status, "running")),
    db.select({ n: count() }).from(fineTunedModels).where(eq(fineTunedModels.status, "active")),
    db.select({ total: sum(creditTransactions.amount) }).from(creditTransactions).where(and(eq(creditTransactions.type, "purchase"), gte(creditTransactions.createdAt, since))),
    db.select({ total: sum(creditTransactions.amount) }).from(creditTransactions).where(and(eq(creditTransactions.type, "deduction"), gte(creditTransactions.createdAt, since))),
    db.select({ n: count() }).from(auditLogs).where(and(eq(auditLogs.severity, "error"), gte(auditLogs.createdAt, since))),
    db.select({ userId: trainingJobs.userId, jobCount: count() }).from(trainingJobs).where(gte(trainingJobs.createdAt, since)).groupBy(trainingJobs.userId).orderBy(desc(count())).limit(5),
    db.select({ date: sql`DATE(created_at AT TIME ZONE 'UTC')`.as("date"), newUsers: count() }).from(users).where(gte(users.createdAt, since)).groupBy(sql`DATE(created_at AT TIME ZONE 'UTC')`).orderBy(sql`DATE(created_at AT TIME ZONE 'UTC')`),
    db.select({ date: sql`DATE(created_at AT TIME ZONE 'UTC')`.as("date"), revenue: sum(payments.amount), txCount: count() }).from(payments).where(and(eq(payments.status, "paid"), gte(payments.createdAt, since))).groupBy(sql`DATE(created_at AT TIME ZONE 'UTC')`).orderBy(sql`DATE(created_at AT TIME ZONE 'UTC')`),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10),
    getQueueStats().catch(() => null),
  ]);

  const topUsersEnriched = await Promise.all(
    topJobUsersRows.map(async (row) => {
      const [u] = await db.select({ email: users.email, name: users.name, plan: users.plan, creditsBalance: users.creditsBalance }).from(users).where(eq(users.id, row.userId));
      return { userId: row.userId, jobCount: row.jobCount, email: u?.email ?? "unknown", name: u?.name ?? null, plan: u?.plan ?? "free", creditsBalance: u?.creditsBalance ?? 0 };
    })
  );

  const completedN = completedJobRows[0]?.n ?? 0;
  const failedN = failedJobRows[0]?.n ?? 0;
  const totalResolved = completedN + failedN;
  const successRate = totalResolved > 0 ? Math.round((completedN / totalResolved) * 100) : null;
  const creditsPurchased = parseInt(String(creditPurchasedRows[0]?.total ?? "0"));
  const creditsSpent = Math.abs(parseInt(String(creditSpentRows[0]?.total ?? "0")));

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    users: { total: totalUsersRows[0]?.n ?? 0, newInPeriod: newUsersRows[0]?.n ?? 0, daily: dailyUsersRows },
    revenue: {
      totalAllTimeInr: parseFloat(String(totalRevenueRows[0]?.total ?? "0")),
      inPeriodInr: parseFloat(String(recentRevenueRows[0]?.total ?? "0")),
      daily: dailyRevenueRows.map((r) => ({ date: r.date, inr: parseFloat(String(r.revenue ?? "0")), transactions: r.txCount })),
    },
    aiCost: {
      totalUsd: parseFloat(String(totalAiCostRows[0]?.total ?? "0")),
      byModel: costByModelRows.map((r) => ({ model: r.model, callType: r.callType, costUsd: parseFloat(String(r.costUsd ?? "0")), tokens: parseInt(String(r.tokens ?? "0")), calls: r.calls })),
    },
    training: { totalAllTime: totalJobRows[0]?.n ?? 0, completedInPeriod: completedN, failedInPeriod: failedN, currentlyRunning: runningJobRows[0]?.n ?? 0, successRatePercent: successRate, activeModels: totalModelsRows[0]?.n ?? 0 },
    credits: { purchasedInPeriod: creditsPurchased, spentInPeriod: creditsSpent, netFlowInPeriod: creditsPurchased - creditsSpent },
    errors: { countInPeriod: errorCountRows[0]?.n ?? 0 },
    topUsers: topUsersEnriched,
    recentActivity: recentAuditRows.map((l) => ({ id: l.id, action: l.action, severity: l.severity, actorEmail: l.actorEmail, resource: l.resource, createdAt: l.createdAt })),
    queue: queueStats ? { available: true, ...queueStats } : { available: false },
    generatedAt: new Date().toISOString(),
  });
}

export const GET = withSentry(handler);
