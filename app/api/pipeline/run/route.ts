import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/run";

// Protect this endpoint with a secret header so it can't be triggered by anyone.
// Set PIPELINE_SECRET in your Vercel environment variables.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-pipeline-secret");

  if (!secret || secret !== process.env.PIPELINE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/pipeline/run] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
