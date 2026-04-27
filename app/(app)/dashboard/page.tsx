// app/(app)/dashboard/page.tsx
// Thin server shell — all data fetching moved to DashboardClient
// Preserves Clerk auth at server level before rendering client
import { requireUser } from "@/lib/auth";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  // Server-side auth check — redirects to /sign-in if not authenticated
  await requireUser();
  // Data fetching is done client-side via /api/dashboard
  // This gives us loading skeletons, error fallbacks, and auto-refresh
  return <DashboardClient />;
}
