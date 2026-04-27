// lib/ai-control/fallbackParser.ts
// PART 1 — STEP 1: FALLBACK PARSER
//
// Purpose: When AI parsing fails or returns low confidence, this deterministic
// keyword-based parser is used as a last resort BEFORE returning an error.
// It never guesses — it only maps clear, unambiguous keyword patterns.
// If no pattern matches, it returns a structured error (never executes).

export type FallbackParseResult =
  | {
      success: true;
      action: string;
      parameters: Record<string, unknown>;
      source: "fallback_parser";
    }
  | {
      success: false;
      error: string;
      source: "fallback_parser";
    };

// Ordered from most-specific to least-specific to avoid false matches
const PATTERNS: Array<{
  test: (prompt: string) => boolean;
  map: (prompt: string) => { action: string; parameters: Record<string, unknown> } | null;
}> = [
  // "enable maintenance" / "turn on maintenance"
  {
    test: (p) => /(enable|turn on|activate)\s+maintenance/i.test(p),
    map: () => ({
      action: "toggle_maintenance",
      parameters: { enabled: true, reason: "Enabled via fallback parser" },
    }),
  },
  // "disable maintenance" / "turn off maintenance"
  {
    test: (p) => /(disable|turn off|deactivate)\s+maintenance/i.test(p),
    map: () => ({
      action: "toggle_maintenance",
      parameters: { enabled: false, reason: "Disabled via fallback parser" },
    }),
  },
  // "enable [feature]" — maps to toggle_feature true
  {
    test: (p) => /\benable\b/i.test(p) && /\b(free tier|registration|queue|training)\b/i.test(p),
    map: (p) => {
      const featureMap: Record<string, string> = {
        "free tier": "features.free_tier_enabled",
        registration: "features.registration_open",
        queue: "features.queue_enabled",
        training: "features.free_tier_enabled",
      };
      for (const [keyword, key] of Object.entries(featureMap)) {
        if (new RegExp(keyword, "i").test(p)) {
          return { action: "toggle_feature", parameters: { key, value: true } };
        }
      }
      return null;
    },
  },
  // "disable [feature]"
  {
    test: (p) => /\bdisable\b/i.test(p) && /\b(free tier|registration|queue|training)\b/i.test(p),
    map: (p) => {
      const featureMap: Record<string, string> = {
        "free tier": "features.free_tier_enabled",
        registration: "features.registration_open",
        queue: "features.queue_enabled",
        training: "features.free_tier_enabled",
      };
      for (const [keyword, key] of Object.entries(featureMap)) {
        if (new RegExp(keyword, "i").test(p)) {
          return { action: "toggle_feature", parameters: { key, value: false } };
        }
      }
      return null;
    },
  },
  // "set price" / "update price" / "change price" — needs value
  {
    test: (p) => /\b(price|pricing|cost)\b/i.test(p),
    map: (p) => {
      // Extract numeric value
      const match = p.match(/(\d+(\.\d+)?)/);
      if (!match) return null; // no value found — cannot proceed safely

      const value = parseFloat(match[1]);
      // Determine which pricing key
      if (/inference|per.?msg|per.?message/i.test(p)) {
        return {
          action: "update_pricing",
          parameters: { key: "pricing.inference_cost_per_msg", value },
        };
      }
      if (/signup|free.?credits|bonus/i.test(p)) {
        return {
          action: "update_pricing",
          parameters: { key: "pricing.free_signup_credits", value },
        };
      }
      return null; // which pricing key is ambiguous
    },
  },
];

/**
 * Deterministic fallback parser. Used ONLY when AI parsing fails.
 * Never executes — only returns a parsed intent or a structured error.
 */
export function runFallbackParser(prompt: string): FallbackParseResult {
  const normalised = prompt.trim().toLowerCase();

  // Safety: injection patterns are blocked before we even get here,
  // but double-check just in case this function is called directly.
  const INJECTION_PATTERNS = [
    "ignore previous",
    "bypass",
    "override system",
    "give admin",
  ];
  for (const pattern of INJECTION_PATTERNS) {
    if (normalised.includes(pattern)) {
      return {
        success: false,
        error: "Unsafe command detected",
        source: "fallback_parser",
      };
    }
  }

  for (const pattern of PATTERNS) {
    if (pattern.test(normalised)) {
      const mapped = pattern.map(normalised);
      if (mapped) {
        return {
          success: true,
          action: mapped.action,
          parameters: mapped.parameters,
          source: "fallback_parser",
        };
      }
    }
  }

  // No pattern matched — return error, do NOT guess
  return {
    success: false,
    error: "Command not recognized. Please be specific (e.g. 'enable free tier', 'set inference price to 3').",
    source: "fallback_parser",
  };
}
