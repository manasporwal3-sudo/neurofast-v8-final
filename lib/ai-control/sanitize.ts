// lib/ai-control/sanitize.ts
// PART 7 — INPUT SANITIZATION
//
// Strips script tags and escapes HTML characters from any user-supplied string.
// Called before storing user text in DB or passing to AI.
// Prevents XSS attacks if content is ever rendered server-side or in email.

/**
 * Remove <script> tags (and their content) from a string.
 * Also removes other dangerous tags: iframe, object, embed, link, style.
 */
export function stripScriptTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|link|style|base|form|input|button|meta)[^>]*>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // remove inline event handlers
    .trim();
}

/**
 * Escape HTML special characters to prevent injection into HTML contexts.
 * Does NOT affect logic — only escapes for safe rendering.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Full sanitize: strips script tags then escapes HTML.
 * Use this on any user-supplied free-text field before storage.
 */
export function sanitize(input: string): string {
  if (typeof input !== "string") return "";
  return escapeHtml(stripScriptTags(input));
}

/**
 * Sanitize an object's string fields recursively.
 * Safe to call on request bodies.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string") {
      result[key] = sanitize(val);
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      result[key] = sanitizeObject(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}
