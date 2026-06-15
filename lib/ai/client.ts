import OpenAI from "openai";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("Missing env var: GROQ_API_KEY is required");
}

const groq = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});

export const LLM_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// Sends a single user prompt to Groq and returns the raw text response.
// Retries up to 3 times on 429 rate limit errors, waiting the retry-after delay each time.
export async function callLLM(prompt: string, maxTokens: number): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      return completion.choices[0]?.message?.content ?? "";
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
