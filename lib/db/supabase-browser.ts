import { createBrowserClient } from "@supabase/ssr";

// Anon-key client for use in Client Components.
// Uses cookies so the session is shared with the server.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
