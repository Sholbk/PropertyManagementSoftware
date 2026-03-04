/**
 * AI Provider abstraction — swap models without changing business logic.
 *
 * Set PMPP_AI_PROVIDER secret to "anthropic" (default) or "openai".
 * Set ANTHROPIC_API_KEY or OPENAI_API_KEY accordingly.
 */

export interface AIResponse {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

export interface AIProvider {
  generate(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<AIResponse>;
}

class ClaudeProvider implements AIProvider {
  async generate(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const model = "claude-sonnet-4-6-20250514";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        system: params.system,
        messages: [{ role: "user", content: params.prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return {
      text: data.content[0].text,
      tokensInput: data.usage.input_tokens,
      tokensOutput: data.usage.output_tokens,
      model,
    };
  }
}

class OpenAIProvider implements AIProvider {
  async generate(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const model = "gpt-4o";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      tokensInput: data.usage.prompt_tokens,
      tokensOutput: data.usage.completion_tokens,
      model,
    };
  }
}

export function getAIProvider(): AIProvider {
  const provider = Deno.env.get("PMPP_AI_PROVIDER") ?? "anthropic";
  switch (provider) {
    case "openai":
      return new OpenAIProvider();
    default:
      return new ClaudeProvider();
  }
}
