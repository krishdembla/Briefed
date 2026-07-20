import OpenAI from "openai";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("Missing env var: GROQ_API_KEY is required");
}

// 30s per attempt — keeps us well inside Vercel's 300s function limit even with retries.
const GROQ_TIMEOUT_MS = 30_000;

const groq = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: GROQ_TIMEOUT_MS,
});

// openai/gpt-oss-20b: OpenAI-published open-weights model on Groq. Production-tier,
// native structured output, no chain-of-thought preamble, ~$0.075/$0.30 per 1M tokens.
// Override via GROQ_MODEL env var.
export const LLM_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

// Sends a single user prompt to Groq and returns the raw text response.
// Retries up to 3 times on 429 rate limit errors, waiting the retry-after delay each time.
export async function callLLM(prompt: string, maxTokens: number): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // reasoning_effort=low + include_reasoning=false keeps gpt-oss models from
      // spending the token budget on hidden chain-of-thought and emitting empty content.
      const completion = await groq.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        reasoning_effort: "low",
        include_reasoning: false,
      } as Parameters<typeof groq.chat.completions.create>[0]);
      return (completion.choices[0]?.message?.content ?? "").trim();
    } catch (err: unknown) {
      const e = err as { status?: number; headers?: Record<string, string> };
      if (e?.status === 429 && attempt < MAX_RETRIES - 1) {
        const retryAfter = parseInt(e?.headers?.["retry-after"] ?? "10", 10);
        console.warn(`[callLLM] Rate limited — retrying in ${retryAfter}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw err;
    }
  }

  throw new Error("[callLLM] Max retries exceeded");
}
