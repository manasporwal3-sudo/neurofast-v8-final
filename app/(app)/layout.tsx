// app/(app)/layout.tsx — v7 POLISH
// Pass user to Sidebar for credits widget + smooth layout transitions

import { requireUser } from "@/lib/auth";
import { hasRole } from "@/lib/services/rbac";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = hasRole(user.role, "admin");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-0, #0a0a0a)" }}>
      <Sidebar isAdmin={isAdmin} user={user} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
