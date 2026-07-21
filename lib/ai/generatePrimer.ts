import fs from "fs";
import path from "path";
import { callLLM } from "./client";

// Read once at module load — same pattern as detectThreads / processArticle.
const PRIMER_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/primer.txt"),
  "utf-8"
);

export interface PrimerCandidate {
  id: string;
  headline: string;
  summary: string | null;
  published_at: string;
}

export interface PrimerTarget {
  headline: string;
  summary: string | null;
  published_at: string;
}

export type PrimerMode =
  | "from_coverage"
  | "hybrid"
  | "background_only"
  | "no_backstory";

export interface PrimerResult {
  primer_md: string;
  sources_used: string[];
  mode: PrimerMode;
}

const VALID_MODES: readonly PrimerMode[] = [
  "from_coverage",
  "hybrid",
  "background_only",
  "no_backstory",
];

// Produces a background primer for a pin given a set of candidate prior pins.
// Candidates come from the pin_relations graph; the LLM decides which are
// actually relevant and lists the IDs it used in sources_used.
export async function generatePrimer(
  target: PrimerTarget,
  candidates: PrimerCandidate[]
): Promise<PrimerResult> {
  const candidatesText =
    candidates.length === 0
      ? "(none — no prior related coverage in Briefed)"
      : candidates
          .map(
            (c) =>
              `- [${c.id}] "${c.headline}" (${c.published_at.slice(0, 10)}) — ${(
                c.summary ?? ""
              )
                .slice(0, 150)
                .replace(/\n/g, " ")}`
          )
          .join("\n");

  const prompt = PRIMER_PROMPT
    .replace("{{targetHeadline}}", target.headline)
    .replace("{{targetPublishedAt}}", target.published_at.slice(0, 10))
    .replace("{{targetSummary}}", target.summary ?? "(no summary available)")
    .replace("{{candidates}}", candidatesText);

  const raw = await callLLM(prompt, 1024);
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  const parsed = JSON.parse(text) as {
    primer_md?: string;
    sources_used?: unknown;
    mode?: string;
  };

  if (
    !parsed?.primer_md?.trim() ||
    !VALID_MODES.includes(parsed.mode as PrimerMode)
  ) {
    throw new Error(
      `Invalid primer LLM output: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }

  // Only trust source IDs the LLM could have seen. Prevents hallucinated UUIDs
  // and stops the LLM from ever citing the target pin itself.
  const candidateIds = new Set(candidates.map((c) => c.id));
  const sourcesUsed = Array.isArray(parsed.sources_used)
    ? (parsed.sources_used as unknown[]).filter(
        (v): v is string => typeof v === "string" && candidateIds.has(v)
      )
    : [];

  return {
    primer_md: parsed.primer_md.trim(),
    sources_used: sourcesUsed,
    mode: parsed.mode as PrimerMode,
  };
}
