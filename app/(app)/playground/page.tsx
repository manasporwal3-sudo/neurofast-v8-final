// app/(app)/playground/page.tsx
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fineTunedModels } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { MessageSquare, Brain } from "lucide-react";

export default async function PlaygroundIndexPage() {
  const user = await requireUser();
  const models = await db
    .select()
    .from(fineTunedModels)
    .where(eq(fineTunedModels.userId, user.id))
    .orderBy(desc(fineTunedModels.createdAt));

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          CHAT <span className="text-cyan-neon">PLAYGROUND</span>
        </h1>
        <p className="font-body text-muted-foreground mt-1">Select a model to start a conversation.</p>
      </div>

      {models.length === 0 ? (
        <div className="cyber-card p-16 text-center">
          <MessageSquare className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="font-body text-muted-foreground mb-4">Train a model first to use the playground.</p>
          <Link href="/train" className="btn-neon px-5 py-2.5 rounded font-display text-sm">TRAIN MODEL →</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <Link
              key={m.id}
              href={`/playground/${m.id}`}
              className="cyber-card p-5 hover:border-cyan-neon/25 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded bg-cyan-neon/10 border border-cyan-neon/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-cyan-neon" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-white">{m.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{m.totalChats} chats</div>
                </div>
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate mb-3">{m.baseModel.split("/")[1]}</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-green-400">● active</span>
                <span className="font-mono text-xs text-cyan-neon opacity-0 group-hover:opacity-100 transition-opacity">
                  OPEN CHAT →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
