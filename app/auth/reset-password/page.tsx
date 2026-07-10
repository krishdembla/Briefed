"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";

// The server-side /auth/callback route exchanges the recovery code and sets the
// session before redirecting here, so this page just needs to call updateUser.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl tracking-tight text-ink">Briefed</h1>
          <p className="text-ink-faint text-sm mt-1.5">Set a new password</p>
        </div>

        <div className="bg-paper-raised border border-rule rounded-lg p-7 shadow-sm">
          <h2 className="font-serif text-xl text-ink mb-6">Choose a new password</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1.5" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-paper border border-rule rounded-md px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1.5" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-paper border border-rule rounded-md px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-[#9e4a3c] text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
