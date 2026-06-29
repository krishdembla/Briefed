"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";

type Mode = "signin" | "signup" | "forgot";

const CALLBACK_ERRORS: Record<string, string> = {
  recovery_failed: "This confirmation link has expired or is invalid. Please request a new one.",
};

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    callbackError ? (CALLBACK_ERRORS[callbackError] ?? "Something went wrong. Please try again.") : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseBrowserClient();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email first — check your inbox for the confirmation link."
          : error.message;
        setError(msg);
      } else {
        router.push("/map");
        router.refresh();
      }
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        // Stay in signup mode so the confirmation message stays visible;
        // the user can switch to sign-in manually once they've confirmed.
        setMessage("Check your email and click the confirmation link. Once confirmed, sign in below.");
      }
    } else {
      // forgot password — route through the server-side callback so PKCE exchange
      // happens there, then forward to the reset form with an active session.
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Password reset email sent — check your inbox.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-white text-3xl font-bold tracking-tight">Briefed</h1>
          <p className="text-zinc-500 text-sm mt-1">Your daily world briefing</p>
        </div>

        {/* Form card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-base mb-5">
            {mode === "signin" ? "Sign in to your account" : mode === "signup" ? "Create an account" : "Reset your password"}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                  placeholder="••••••••"
                />
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="mt-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}
            {message && <p className="text-emerald-400 text-xs">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
            </button>
          </form>
        </div>

        {/* Mode toggle */}
        <p className="text-center text-xs text-zinc-600 mt-4">
          {mode === "forgot" ? "Remember it? " : mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => switchMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup")}
            className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
          >
            {mode === "forgot" ? "Sign in" : mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
