import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/run";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  // Vercel Cron sends Bearer <CRON_SECRET>; manual triggers use PIPELINE_SECRET
  return (
    auth === `Bearer ${process.env.CRON_SECRET}` ||
    auth === `Bearer ${process.env.PIPELINE_SECRET}`
  );
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/pipeline] Pipeline failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: called by Vercel Cron at 06:00 UTC daily
export const GET = handle;
// POST: manual trigger from scripts or admin tools
export const POST = handle;
