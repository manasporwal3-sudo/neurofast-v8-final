// lib/ai-control/promptGuard.ts — v6 UPGRADE
// Extended with advanced injection patterns, encoding attacks, and multi-language variants
// Called BEFORE any AI parsing begins. Returns { safe, reason } or { safe: true }.

export interface GuardResult {
  safe: boolean;
  reason?: string;
  pattern?: string;
}

// ── Injection pattern database ─────────────────────────────────────────────
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Classic instruction overrides
  { pattern: /ignore\s+(previous|prior|all)\s+instructions?/i,        label: "ignore_instructions" },
  { pattern: /forget\s+(your\s+)?(instructions?|rules?|guidelines?)/i, label: "forget_instructions" },
  { pattern: /disregard\s+(previous|all|any|the\s+(above|prior))/i,   label: "disregard_previous" },
  { pattern: /override\s+(system|your|all)\s*(prompt|rules?)?/i,       label: "override_system" },

  // Privilege escalation
  { pattern: /give\s+(me\s+)?admin\s+(access|rights|privileges)/i,     label: "admin_escalation" },
  { pattern: /\bsudo\b/i,                                               label: "sudo_escalation" },
  { pattern: /act\s+as\s+(if\s+you\s+(have\s+)?)?no\s+(restrictions?|rules?|limits?)/i, label: "no_restrictions" },
  { pattern: /you\s+(are\s+now|have\s+been)\s+(a\s+)?different/i,      label: "persona_swap" },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|other)/i, label: "pretend_persona" },
  { pattern: /jailbreak/i,                                              label: "jailbreak" },

  // System prompt extraction
  { pattern: /system\s+prompt\s*(:|is|=|above)/i,                      label: "system_prompt_reveal" },
  { pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i,              label: "prompt_reveal" },
  { pattern: /show\s+(me\s+)?your\s+(instructions?|system|context)/i,  label: "context_reveal" },
  { pattern: /what\s+(are|were)\s+your\s+(initial\s+)?instructions?/i, label: "instruction_query" },

  // Bypass keywords
  { pattern: /\bbypass\b/i,                                             label: "bypass" },
  { pattern: /\bjailbroken?\b/i,                                        label: "jailbroken" },
  { pattern: /\bdeveloper\s+mode\b/i,                                   label: "developer_mode" },
  { pattern: /\bdan\s+mode\b/i,                                         label: "dan_mode" },
  { pattern: /\bunrestricted\s+mode\b/i,                                label: "unrestricted_mode" },
  
  // Encoding / obfuscation attacks
  { pattern: /base64\s*(decode|encoded)/i,                              label: "base64_encoding" },
  { pattern: /\\u[0-9a-fA-F]{4}/,                                      label: "unicode_escape" },
  { pattern: /&#x[0-9a-fA-F]+;/,                                       label: "html_entity_encoding" },

  // Indirect / many-shot attacks
  { pattern: /repeat\s+after\s+me[:：]/i,                              label: "repeat_after_me" },
  { pattern: /translate\s+(the\s+)?following\s+(to|into)\s+english/i,  label: "translation_bypass" },
  { pattern: /\bbelow\s+is\s+a\s+(new\s+)?system\s+prompt\b/i,        label: "system_prompt_injection" },
  { pattern: /\[\s*system\s*\]/i,                                       label: "fake_system_tag" },
  { pattern: /<\s*system\s*>/i,                                         label: "html_system_tag" },
  
  // Role injection
  { pattern: /you\s+are\s+now\s+(an?\s+)?(ai|assistant|bot|model)\s+that/i, label: "role_injection" },
  { pattern: /from\s+now\s+on\s+(you|act|behave|respond)/i,            label: "from_now_on" },
  { pattern: /your\s+new\s+(role|purpose|goal|task)\s+is/i,            label: "new_role" },
];

// Safety caps
const MAX_PROMPT_LENGTH = 800; // Increased from 500 to allow legitimate longer queries

/**
 * Validate a user prompt for injection attempts before sending to AI.
 * v6: Extended patterns, encoding detection, better logging.
 */
export function guardPrompt(prompt: string): GuardResult {
  if (!prompt || typeof prompt !== "string") {
    return { safe: false, reason: "Empty or invalid prompt" };
  }

  const trimmed = prompt.trim();

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return { safe: false, reason: `Prompt exceeds maximum length (${MAX_PROMPT_LENGTH} chars)` };
  }

  // Decode common obfuscation before checking
  // Collapse whitespace variants (tab/newline tricks)
  const normalised = trimmed
    .replace(/\s+/g, " ")
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, ""); // zero-width chars

  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(normalised)) {
      console.warn(`[PromptGuard v6] Injection blocked: ${label} — "${trimmed.slice(0, 80)}"`);
      return {
        safe: false,
        reason: "Unsafe command detected",
        pattern: label,
      };
    }
  }

  return { safe: true };
}

/**
 * Sanitize and guard in one call — for admin AI brain routes.
 * Returns sanitized prompt or throws if injection detected.
 */
export function guardAndSanitize(prompt: string): string {
  const result = guardPrompt(prompt);
  if (!result.safe) {
    throw new Error(result.reason ?? "Prompt blocked by safety guard");
  }
  return prompt.trim();
}
