import { createClient } from "@supabase/supabase-js";

// Anon-key client for server-side API routes that read publicly accessible data.
// Respects RLS — never use this for operations requiring elevated privileges.
export const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
