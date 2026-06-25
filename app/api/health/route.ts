import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";

// Lightweight liveness + readiness check.
// Returns 200 when all services are reachable, 503 otherwise.
// Called by Vercel deploy previews and can be used for manual smoke tests.
export async function GET(): Promise<NextResponse> {
  const checks: Record<string, "ok" | string> = {};

  // Check Supabase connectivity with a minimal query
  try {
    const { error } = await supabase.from("pins").select("id").limit(1);
    checks.supabase = error ? error.message : "ok";
  } catch (err) {
    checks.supabase = err instanceof Error ? err.message : "unreachable";
  }

  // Verify critical env vars are present (no values exposed)
  const requiredEnvVars = [
    "GROQ_API_KEY",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_MAPBOX_TOKEN",
    "CRON_SECRET",
  ];
  const missingEnvVars = requiredEnvVars.filter((k) => !process.env[k]);
  checks.env = missingEnvVars.length === 0 ? "ok" : `missing: ${missingEnvVars.join(", ")}`;

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 }
  );
}
