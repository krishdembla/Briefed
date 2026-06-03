import fs from "fs";
import path from "path";
import { anthropic, CLAUDE_MODEL } from "./client";
import type { MapPin } from "@/types/map";

const PROMPT_PATH = path.join(process.cwd(), "prompts/quiz-question.txt");

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

// Generates a cross-story quiz question connecting two pins.
// Returns null on failure so callers can skip the quiz gracefully.
export async function generateQuiz(
  pin1: MapPin,
  pin2: MapPin
): Promise<QuizQuestion | null> {
  const prompt = fs.readFileSync(PROMPT_PATH, "utf-8")
    .replace("{{HEADLINE_1}}", pin1.headline)
    .replace("{{SUMMARY_1}}", pin1.summary ?? pin1.headline)
    .replace("{{HEADLINE_2}}", pin2.headline)
    .replace("{{SUMMARY_2}}", pin2.summary ?? pin2.headline);

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0];
    if (raw.type !== "text") return null;

    // Claude occasionally wraps JSON in markdown fences despite the prompt; strip them.
    const text = raw.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text) as QuizQuestion;

    // Basic shape validation
    if (
      typeof parsed.question !== "string" ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      typeof parsed.correctIndex !== "number" ||
      parsed.correctIndex < 0 ||
      parsed.correctIndex > 3 ||
      typeof parsed.explanation !== "string"
    ) {
      console.error("[generateQuiz] Unexpected shape:", parsed);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("[generateQuiz] Failed:", err);
    return null;
  }
}
