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

// llama-3.3-70b-versatile is deprecated (decommissioned Aug 16 2026).
// Qwen3 32B is the correct replacement — note there is no 27B variant in the Qwen3 lineup.
// Override via GROQ_MODEL env var.
export const LLM_MODEL = process.env.GROQ_MODEL ?? "qwen/qwen3-32b";

// Sends a single user prompt to Groq and returns the raw text response.
// Retries up to 3 times on 429 rate limit errors, waiting the retry-after delay each time.
export async function callLLM(prompt: string, maxTokens: number): Promise<string> {
  const MAX_RETRIES = 3;

  // /no-think disables Qwen3's chain-of-thought mode. Without this the model emits
  // a large <think> block before every response, adding 5-20s of latency per call
  // and causing the pipeline to exceed Vercel's 300s function limit.
  const promptWithNoThink = `/no-think\n\n${prompt}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: promptWithNoThink }],
      });
      const content = completion.choices[0]?.message?.content ?? "";
      // Strip any residual <think> blocks just in case the model ignores /no-think.
      return content.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
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
