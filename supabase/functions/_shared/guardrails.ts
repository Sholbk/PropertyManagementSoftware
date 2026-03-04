/**
 * AI Guardrails — safety checks before and after AI calls.
 *
 * Enforces:
 * 1. Org-scoped data only (no cross-tenant data in prompts)
 * 2. PII scrubbing from prompts
 * 3. Output validation (parseable JSON, required fields)
 * 4. Human review flagging
 * 5. Rate limiting per org
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =========================================================================
// PII SCRUBBING
// =========================================================================

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN_REDACTED]" },
  // Phone numbers
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: "[PHONE_REDACTED]" },
  // Email in free text (keep emails that are part of structured data)
  { pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, replacement: "[EMAIL_REDACTED]" },
  // Credit card numbers
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: "[CC_REDACTED]" },
  // Date of birth patterns
  { pattern: /\b(DOB|date of birth|born)\s*:?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi, replacement: "[DOB_REDACTED]" },
];

export function scrubPII(text: string): string {
  let scrubbed = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  return scrubbed;
}

// =========================================================================
// ORG SCOPE VERIFICATION
// =========================================================================

/**
 * Verify that all entity IDs in a prompt context belong to the specified org.
 * Prevents accidental cross-tenant data inclusion.
 */
export async function verifyOrgScope(
  supabase: SupabaseClient,
  orgId: string,
  entities: Array<{ table: string; id: string }>
): Promise<{ valid: boolean; violations: string[] }> {
  const violations: string[] = [];

  for (const { table, id } of entities) {
    const { data, error } = await supabase
      .from(table)
      .select("organization_id")
      .eq("id", id)
      .single();

    if (error || !data) {
      violations.push(`${table}:${id} not found`);
    } else if (data.organization_id !== orgId) {
      violations.push(`${table}:${id} belongs to different org`);
    }
  }

  return { valid: violations.length === 0, violations };
}

// =========================================================================
// OUTPUT VALIDATION
// =========================================================================

/**
 * Parse and validate AI JSON output.
 * Returns parsed object or null if invalid.
 */
export function parseAIResponse<T>(
  raw: string,
  requiredFields: string[]
): { parsed: T | null; error: string | null } {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Check required fields
    const missing = requiredFields.filter((f) => !(f in parsed));
    if (missing.length > 0) {
      return { parsed: null, error: `Missing fields: ${missing.join(", ")}` };
    }

    return { parsed: parsed as T, error: null };
  } catch (e) {
    return { parsed: null, error: `Invalid JSON: ${(e as Error).message}` };
  }
}

// =========================================================================
// HUMAN REVIEW CHECK
// =========================================================================

export interface ReviewDecision {
  needsReview: boolean;
  reasons: string[];
}

/**
 * Determine if an AI result should be flagged for human review.
 * Called after every AI response before applying the result.
 */
export function checkHumanReview(
  aiResult: Record<string, unknown>,
  context: {
    priority?: string;
    estimatedCost?: number;
    confidenceThreshold?: number;
  } = {}
): ReviewDecision {
  const reasons: string[] = [];

  // AI explicitly flagged for review
  if (aiResult.requires_human_review === true) {
    reasons.push(aiResult.review_reason as string ?? "AI flagged for review");
  }

  // Low confidence
  const confidence = aiResult.confidence as number;
  const threshold = context.confidenceThreshold ?? 0.7;
  if (typeof confidence === "number" && confidence < threshold) {
    reasons.push(`Low confidence: ${confidence} (threshold: ${threshold})`);
  }

  // High cost estimates need approval
  const estCost = (aiResult.estimated_cost_high ?? aiResult.estimated_cost ?? context.estimatedCost) as number;
  if (typeof estCost === "number" && estCost > 5000) {
    reasons.push(`High estimated cost: $${estCost}`);
  }

  // Emergency priority always reviewed
  if (context.priority === "emergency") {
    reasons.push("Emergency priority — requires human confirmation");
  }

  return {
    needsReview: reasons.length > 0,
    reasons,
  };
}

// =========================================================================
// RATE LIMITING
// =========================================================================

/**
 * Check if an org has exceeded its AI call budget.
 * Reads tier-aware limits from org's plan_limits if no overrides provided.
 * Returns true if the call should proceed.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  orgId: string,
  limits: { maxCallsPerHour?: number; maxCallsPerDay?: number } = {}
): Promise<{ allowed: boolean; reason?: string }> {
  // If no explicit limits, look up the org's plan-based limits
  let maxPerHour = limits.maxCallsPerHour;
  let maxPerDay = limits.maxCallsPerDay;

  if (maxPerHour === undefined || maxPerDay === undefined) {
    const { data: org } = await supabase
      .from("organizations")
      .select("plan_limits")
      .eq("id", orgId)
      .single();

    const planLimits = org?.plan_limits as Record<string, number> | null;
    maxPerHour = maxPerHour ?? planLimits?.ai_calls_per_hour ?? 100;
    maxPerDay = maxPerDay ?? planLimits?.ai_calls_per_day ?? 1000;
  }

  // Count calls in last hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourCount } = await supabase
    .from("ai_action_logs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", hourAgo);

  if ((hourCount ?? 0) >= maxPerHour) {
    return { allowed: false, reason: `Hourly limit exceeded (${maxPerHour}/hr)` };
  }

  // Count calls today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: dayCount } = await supabase
    .from("ai_action_logs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", todayStart.toISOString());

  if ((dayCount ?? 0) >= maxPerDay) {
    return { allowed: false, reason: `Daily limit exceeded (${maxPerDay}/day)` };
  }

  // Increment AI usage quota for the current billing period
  const today = new Date().toISOString().slice(0, 10);
  await supabase.rpc("increment_ai_usage", { p_org_id: orgId, p_date: today }).maybeSingle();

  return { allowed: true };
}
