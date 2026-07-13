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
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(
    callbackError ? (CALLBACK_ERRORS[callbackError] ?? "Something went wrong. Please try again.") : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);

  const supabase = createSupabaseBrowserClient();

  const PASSWORD_MIN = 8;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
    setPasswordConfirm("");
    setSignupSuccessEmail(null);
    setOtpCode("");
  }

  // Users type the numeric code from their confirmation email — this path is
  // immune to Gmail's link-scanning bots that consume one-shot magic links.
  // Supabase's OTP length is project-configurable (6–8 digits), so we accept
  // any length in that range and let the server validate.
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!signupSuccessEmail) return;
    const trimmed = otpCode.replace(/\s/g, "");
    if (trimmed.length < 6 || trimmed.length > 8) {
      setError("Enter the code from your email (usually 6–8 digits).");
      return;
    }
    setError(null);
    setOtpVerifying(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: signupSuccessEmail,
      token: trimmed,
      type: "signup",
    });

    if (verifyError) {
      setError(
        verifyError.message.toLowerCase().includes("expired")
          ? "That code has expired. Sign up again to get a new one."
          : "That code didn't work. Double-check the email and try again."
      );
      setOtpVerifying(false);
      return;
    }

    // Session is live — fire the welcome email and land on onboarding.
    fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
    router.push("/onboarding");
    router.refresh();
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
      // Client-side guards before hitting Supabase. Cheap UX wins that also
      // stop obvious typos from creating unreachable accounts.
      if (password.length < PASSWORD_MIN) {
        setError(`Password must be at least ${PASSWORD_MIN} characters.`);
        setLoading(false);
        return;
      }
      if (password !== passwordConfirm) {
        setError("Passwords don't match.");
        setLoading(false);
        return;
      }

      const emailRedirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) {
        // Supabase's rate-limit and "already registered" messages are
        // reasonable — surface them verbatim so the user knows what to do.
        setError(error.message);
      } else if (data.user?.identities && data.user.identities.length === 0) {
        // Supabase's obfuscated "email already registered" response: the user
        // object comes back but with no identities. Point them at sign-in
        // instead of leaving them re-attempting signup.
        setError(
          "An account with this email already exists. Try signing in, or use \"Forgot password\" if you don't remember it."
        );
      } else if (data.session) {
        // Email confirmations are OFF at the Supabase project level — user is
        // auto-signed-in. Fire the branded welcome email and go to onboarding.
        fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
        router.push("/onboarding");
        router.refresh();
      } else {
        // Email-confirmation flow (Confirm email toggled ON in Supabase).
        // signUp resolved without error, so the account was created and a
        // confirmation email was sent — even if `data.user` came back null
        // (which happens on some SDK versions when a session isn't returned).
        // Swap to a dedicated success view — leaving the form on-screen makes
        // users think the submit didn't take.
        setSignupSuccessEmail(email);
        setPassword("");
        setPasswordConfirm("");
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
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl tracking-tight text-ink">Briefed</h1>
          <p className="text-ink-faint text-sm mt-1.5">Your daily world briefing</p>
        </div>

        {/* Success card — shown after a successful signup that requires email
             confirmation. Replaces the form entirely so users don't think
             their submit failed. Presents a 6-digit code input as the primary
             confirmation path (magic links are consumed by Gmail scanners). */}
        {signupSuccessEmail ? (
          <div className="bg-paper-raised border border-rule rounded-lg p-7 shadow-sm">
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl text-ink mb-2">Check your inbox</h2>
              <p className="text-sm text-ink-soft leading-relaxed">
                We sent a 6-digit code to
              </p>
              <p className="font-mono text-sm text-ink mt-1 break-all">{signupSuccessEmail}</p>
            </div>

            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <label htmlFor="otp" className="block text-[11px] uppercase tracking-wider text-ink-faint">
                Confirmation code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full bg-paper border border-rule rounded-md px-3 py-3 text-center text-xl font-mono tracking-[0.4em] text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
                placeholder="00000000"
                autoFocus
              />

              {error && <p className="text-[#9e4a3c] text-xs leading-relaxed">{error}</p>}

              <button
                type="submit"
                disabled={otpVerifying || otpCode.length < 6}
                className="mt-1 w-full py-2.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {otpVerifying ? "Verifying…" : "Confirm & continue"}
              </button>
            </form>

            <p className="text-[11px] text-ink-faint text-center mt-4 leading-relaxed">
              Don{"'"}t see it? Check your spam folder. The code expires in 1 hour.
            </p>

            <button
              type="button"
              onClick={() => {
                setSignupSuccessEmail(null);
                setOtpCode("");
                setError(null);
                setMode("signup");
              }}
              className="w-full mt-4 py-2 text-xs text-ink-faint hover:text-ink transition-colors"
            >
              Used the wrong email? Sign up again
            </button>
          </div>
        ) : (
        <div className="bg-paper-raised border border-rule rounded-lg p-7 shadow-sm">
          <h2 className="font-serif text-xl text-ink mb-6">
            {mode === "signin" ? "Sign in to your account" : mode === "signup" ? "Create an account" : "Reset your password"}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-paper border border-rule rounded-md px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1.5" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "signup" ? PASSWORD_MIN : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-md px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
                  placeholder={mode === "signup" ? `At least ${PASSWORD_MIN} characters` : "••••••••"}
                />
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="mt-2 text-xs text-ink-faint hover:text-ink transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1.5" htmlFor="passwordConfirm">
                  Confirm password
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  required
                  minLength={PASSWORD_MIN}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-md px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
                  placeholder="Re-enter password"
                  aria-invalid={passwordConfirm.length > 0 && password !== passwordConfirm}
                />
                {passwordConfirm.length > 0 && password !== passwordConfirm && (
                  <p className="mt-1.5 text-[11px] text-[#9e4a3c]">Passwords don{"'"}t match.</p>
                )}
              </div>
            )}

            {error && <p className="text-[#9e4a3c] text-xs leading-relaxed">{error}</p>}
            {message && <p className="text-accent text-xs leading-relaxed">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
            </button>
          </form>
        </div>
        )}

        {/* Mode toggle — hidden on the post-signup success screen */}
        {!signupSuccessEmail && (
          <p className="text-center text-xs text-ink-faint mt-5">
            {mode === "forgot" ? "Remember it? " : mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => switchMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup")}
              className="text-accent hover:text-accent-hover transition-colors underline underline-offset-2"
            >
              {mode === "forgot" ? "Sign in" : mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        )}
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
