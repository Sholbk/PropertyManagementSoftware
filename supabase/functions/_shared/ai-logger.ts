import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Logs every AI action to ai_action_logs.
 * Called after every AI invocation — success or failure.
 * Uses admin client (service_role) to bypass RLS.
 */
export interface AILogEntry {
  organization_id: string;
  user_id?: string | null;
  action_type:
    | "classification"
    | "recommendation"
    | "generation"
    | "analysis"
    | "prediction"
    | "automation"
    | "chat_response";
  domain: string;
  context_entity?: string;
  context_id?: string;
  input_summary: string;
  output_summary: string;
  full_prompt?: string;
  full_response?: string;
  model_provider: string;
  model_id: string;
  tokens_input?: number;
  tokens_output?: number;
  latency_ms?: number;
  cost_usd?: number;
  was_accepted?: boolean;
  feedback?: string;
}

export async function logAIAction(
  supabase: SupabaseClient,
  entry: AILogEntry
): Promise<void> {
  const { error } = await supabase.from("ai_action_logs").insert({
    organization_id: entry.organization_id,
    user_id: entry.user_id ?? null,
    action_type: entry.action_type,
    domain: entry.domain,
    context_entity: entry.context_entity ?? null,
    context_id: entry.context_id ?? null,
    input_summary: entry.input_summary.substring(0, 500),
    output_summary: entry.output_summary.substring(0, 500),
    full_prompt: entry.full_prompt ?? null,
    full_response: entry.full_response ?? null,
    model_provider: entry.model_provider,
    model_id: entry.model_id,
    tokens_input: entry.tokens_input ?? null,
    tokens_output: entry.tokens_output ?? null,
    latency_ms: entry.latency_ms ?? null,
    cost_usd: entry.cost_usd ?? null,
    was_accepted: entry.was_accepted ?? null,
    feedback: entry.feedback ?? null,
  });

  if (error) {
    console.error("Failed to log AI action:", error.message);
  }
}

/**
 * Estimate cost in USD based on model and token counts.
 * Prices as of 2025 — update as needed.
 */
export function estimateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-6-20250514": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
    "claude-haiku-4-5-20251001": { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
    "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  };

  const rates = pricing[model] ?? { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 };
  return tokensIn * rates.input + tokensOut * rates.output;
}
