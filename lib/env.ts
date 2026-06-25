// Validates that all required server-side env vars are present.
// Import this at the top of any server entry point (API routes, pipeline).
// Throws at module load time so bad deploys surface immediately.

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
  "NEWSAPI_KEY",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "PIPELINE_SECRET",
  "CRON_SECRET",
  "ADMIN_EMAIL",
] as const;

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[env] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}`
  );
}

// Re-export as typed constants so callers don't need to non-null assert
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  groqApiKey: process.env.GROQ_API_KEY!,
  newsApiKey: process.env.NEWSAPI_KEY!,
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN!,
  resendApiKey: process.env.RESEND_API_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  pipelineSecret: process.env.PIPELINE_SECRET!,
  cronSecret: process.env.CRON_SECRET!,
  adminEmail: process.env.ADMIN_EMAIL!,
} as const;
