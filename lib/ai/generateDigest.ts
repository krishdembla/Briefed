import fs from "fs";
import path from "path";
import { callLLM } from "./client";

const DIGEST_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/email-digest.txt"),
  "utf-8"
);

// Generates a one-sentence teaser intro for the daily digest email.
// Falls back to a safe default if Claude fails so sends are never blocked.
export async function generateDigestIntro(headlines: string[]): Promise<string> {
  const headlineList = headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
  const prompt = DIGEST_PROMPT.replace("{{headlines}}", headlineList);

  try {
    const text = (await callLLM(prompt, 100)).trim();
    console.log(`[generateDigest] Intro: "${text}"`);
    return text || fallbackIntro();
  } catch (err) {
    console.error("[generateDigest] LLM call failed, using fallback:", err);
    return fallbackIntro();
  }
}

function fallbackIntro(): string {
  return "Your world this morning — open the map to see what's moving";
}
