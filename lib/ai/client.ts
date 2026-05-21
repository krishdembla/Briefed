import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("Missing env var: ANTHROPIC_API_KEY is required");
}

export const anthropic = new Anthropic({ apiKey });

// Default model for all pipeline calls
export const CLAUDE_MODEL = "claude-sonnet-4-6";
