// lib/services/rbac.ts
// Role-based access control — wraps existing auth without replacing it
// Role column already exists in users table (default: "user")

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";

export type UserRole = "user" | "admin" | "superadmin";

// Check if a user has the required role
export function hasRole(userRole: string, required: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = { user: 0, admin: 1, superadmin: 2 };
  return (hierarchy[userRole as UserRole] ?? 0) >= hierarchy[required];
}

// Require admin role in API routes
// Returns user object if authorized, NextResponse if not
export async function requireAdmin(): Promise<
  | { id: string; role: string; email: string; name: string | null }
  | NextResponse
> {
  const user = await getUserForApi();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(user.role, "admin")) {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }
  return user;
}

// Promote a user to admin (superadmin only, or direct DB)
export async function promoteToAdmin(targetUserId: string): Promise<void> {
  await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, targetUserId));
}

// Demote admin back to user
export async function demoteToUser(targetUserId: string): Promise<void> {
  await db
    .update(users)
    .set({ role: "user", updatedAt: new Date() })
    .where(eq(users.id, targetUserId));
}

// Type guard: narrow result from requireAdmin
export function isAdminUser(
  result: Awaited<ReturnType<typeof requireAdmin>>
): result is { id: string; role: string; email: string; name: string | null } {
  return !(result instanceof NextResponse);
}
