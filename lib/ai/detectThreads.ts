import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import { supabase } from "@/lib/db/supabase-service";

const PROMPT_PATH = path.join(process.cwd(), "prompts/detect-threads.txt");

interface PinRow {
  id: string;
  headline: string;
  summary: string | null;
  topic: string | null;
}

interface LLMMatch {
  newIndex: number;
  recentIndex: number;
  confidence: number;
  reason: string;
}

// Ensures canonical pair ordering (smaller UUID first) to prevent storing
// both (A,B) and (B,A) as separate rows. The unique constraint covers this too,
// but this keeps insertions idempotent regardless of which pin is "new".
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function detectForTopic(
  topic: string,
  newPins: PinRow[],
  recentPins: PinRow[]
): Promise<Array<{ pinIdA: string; pinIdB: string; confidence: number }>> {
  const prompt = fs.readFileSync(PROMPT_PATH, "utf-8")
    .replace(
      "{{newArticles}}",
      newPins
        .map((p, i) => `[${i}] "${p.headline}" | ${(p.summary ?? "").slice(0, 120).replace(/\n/g, " ")}`)
        .join("\n")
    )
    .replace(
      "{{recentArticles}}",
      recentPins
        .map((p, i) => `[${i}] "${p.headline}" | ${(p.summary ?? "").slice(0, 120).replace(/\n/g, " ")}`)
        .join("\n")
    );

  try {
    const raw = await callLLM(prompt, 1024);
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const matches = JSON.parse(text) as LLMMatch[];

    if (!Array.isArray(matches)) return [];

    return matches
      .filter(
        (m) =>
          m.confidence >= 0.7 &&
          m.newIndex >= 0 && m.newIndex < newPins.length &&
          m.recentIndex >= 0 && m.recentIndex < recentPins.length
      )
      .map((m) => {
        const [a, b] = canonicalPair(newPins[m.newIndex].id, recentPins[m.recentIndex].id);
        console.log(`[detectThreads] ${topic} match (${m.confidence}): "${newPins[m.newIndex].headline.slice(0, 50)}" ↔ "${recentPins[m.recentIndex].headline.slice(0, 50)}"`);
        return { pinIdA: a, pinIdB: b, confidence: m.confidence };
      });
  } catch (err) {
    console.error(`[detectThreads] LLM parse failed for topic "${topic}":`, err);
    return [];
  }
}

// Compares newly stored pins against the past 5 days of history to find
// story continuations. Runs one LLM call per topic. Safe to call even if it
// fails — the pipeline marks success regardless of thread detection outcome.
export async function detectThreads(runId: string): Promise<number> {
  // Newly stored pins from this run (need summaries to compare meaningfully)
  const { data: newPins, error: newErr } = await supabase
    .from("pins")
    .select("id, headline, summary, topic")
    .eq("pipeline_run_id", runId)
    .not("summary", "is", null);

  if (newErr || !newPins?.length) {
    console.log("[detectThreads] No new pins with summaries — skipping");
    return 0;
  }

  // Recent pins from past 5 days, excluding this run
  const since = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPins, error: recentErr } = await supabase
    .from("pins")
    .select("id, headline, summary, topic")
    .neq("pipeline_run_id", runId)
    .gte("published_at", since)
    .not("summary", "is", null)
    .limit(200);

  if (recentErr || !recentPins?.length) {
    console.log("[detectThreads] No recent pins for comparison — skipping");
    return 0;
  }

  const topics = [...new Set((newPins as PinRow[]).map((p) => p.topic ?? "other"))];
  const allPairs: Array<{ pinIdA: string; pinIdB: string; confidence: number }> = [];

  for (const topic of topics) {
    const topicNew = (newPins as PinRow[]).filter((p) => (p.topic ?? "other") === topic).slice(0, 20);
    const topicRecent = (recentPins as PinRow[]).filter((p) => (p.topic ?? "other") === topic).slice(0, 25);

    if (topicNew.length === 0 || topicRecent.length === 0) continue;

    console.log(`[detectThreads] ${topic}: ${topicNew.length} new vs ${topicRecent.length} recent`);

    const pairs = await detectForTopic(topic, topicNew, topicRecent);
    allPairs.push(...pairs);
  }

  if (allPairs.length === 0) {
    console.log("[detectThreads] No thread matches found");
    return 0;
  }

  const { error: insertErr } = await supabase
    .from("pin_relations")
    .upsert(
      allPairs.map((p) => ({ pin_id_a: p.pinIdA, pin_id_b: p.pinIdB, confidence: p.confidence })),
      { onConflict: "pin_id_a,pin_id_b", ignoreDuplicates: true }
    );

  if (insertErr) {
    console.error("[detectThreads] Insert failed:", insertErr.message);
    return 0;
  }

  console.log(`[detectThreads] Created ${allPairs.length} thread relation(s)`);
  return allPairs.length;
}
