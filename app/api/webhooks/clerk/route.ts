// app/api/webhooks/clerk/route.ts
// Sync Clerk user creation/updates to our database

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as ClerkWebhookEvent;

    if (payload.type === "user.created") {
      const { id, email_addresses, first_name, last_name, image_url } = payload.data;
      const email = email_addresses[0]?.email_address ?? "";
      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      await db
        .insert(users)
        .values({
          clerkId: id,
          email,
          name,
          avatarUrl: image_url,
          creditsBalance: 100,
        })
        .onConflictDoNothing();
    }

    if (payload.type === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } = payload.data;
      const email = email_addresses[0]?.email_address ?? "";
      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      await db
        .update(users)
        .set({ email, name, avatarUrl: image_url, updatedAt: new Date() })
        .where(eq(users.clerkId, id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Clerk webhook]", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
