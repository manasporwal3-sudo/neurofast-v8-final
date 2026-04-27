// lib/services/sentry.ts
// Thin wrapper — lets API routes capture errors to Sentry without
// importing Sentry directly everywhere. Gracefully no-ops if DSN not set.

import { NextRequest, NextResponse } from "next/server";

type ApiHandler = (req: NextRequest, context?: unknown) => Promise<NextResponse>;

// Wrap an API handler with Sentry error capture + automatic 500 response
export function withSentry(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (err) {
      // Capture to Sentry if available
      if (process.env.SENTRY_DSN) {
        try {
          const Sentry = await import("@sentry/nextjs");
          Sentry.captureException(err, {
            extra: {
              url: req.url,
              method: req.method,
            },
          });
        } catch {
          // Sentry import failed — continue
        }
      }

      console.error("[API Error]", req.method, req.url, err);

      return NextResponse.json(
        {
          error: "Internal server error",
          message:
            process.env.NODE_ENV === "development"
              ? String(err)
              : "Something went wrong. Our team has been notified.",
        },
        { status: 500 }
      );
    }
  };
}

// Capture a non-fatal exception (for use in catch blocks)
export async function captureError(
  err: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, { extra: context });
  } catch {
    // Sentry unavailable — just log
    console.error("[CaptureError]", err, context);
  }
}
