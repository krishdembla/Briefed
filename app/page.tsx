import Link from "next/link";
import { TOPIC_COLORS } from "@/types/map";

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m6 7l-5.447 2.724A1 1 0 0115 19.382V8.618a1 1 0 00-1.447-.894L9 10" />
      </svg>
    ),
    title: "News on a map",
    body: "Every story is placed where it happened. Tap any pin to get the summary, stats, and source — no doomscrolling required.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Personalised morning digest",
    body: "Each morning Briefed emails you a curated set of stories based on the topics you follow and what you actually read.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Build a reading habit",
    body: "Read 3 stories a day to check in. Your streak tracks how consistently you stay informed — no guilt, just momentum.",
  },
];

const TOPICS = ["Politics", "Economy", "Conflict", "Health", "Climate", "Tech"] as const;
const TOPIC_KEYS: Record<string, string> = {
  Politics: "politics", Economy: "economy", Conflict: "conflict",
  Health: "health", Climate: "climate", Tech: "tech",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">

      {/* Masthead */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto border-b border-rule">
        <span className="font-serif text-2xl tracking-tight text-ink">Briefed</span>
        <div className="flex items-center gap-5">
          <Link
            href="/auth"
            className="text-sm text-ink-soft hover:text-ink transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-faint mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Updated 3× daily from global sources
        </div>

        <h1 className="font-serif text-6xl sm:text-7xl leading-[1.02] tracking-tight mb-7">
          The world,
          <br />
          in <span className="italic text-accent">three minutes</span>.
        </h1>

        <p className="text-ink-soft text-lg leading-relaxed max-w-xl mx-auto mb-10">
          Briefed maps live global news as interactive pins and delivers a
          personalised morning digest — so you know what matters, every day.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth"
            className="w-full sm:w-auto px-8 py-3.5 rounded-md bg-accent text-white font-medium text-sm hover:bg-accent-hover active:scale-[0.99] transition-all"
          >
            Start reading free
          </Link>
          <Link
            href="/auth"
            className="w-full sm:w-auto px-8 py-3.5 rounded-md border border-rule-strong text-ink-soft font-medium text-sm hover:border-ink hover:text-ink transition-all"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Topic preview */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="border-y border-rule py-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-faint text-center mb-7">
            Six topics · One feed
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {TOPICS.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-2.5 font-serif text-xl text-ink"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: TOPIC_COLORS[TOPIC_KEYS[label]] }}
                />
                {label}
              </span>
            ))}
          </div>
          <p className="text-center text-sm text-ink-faint mt-8">
            Pick your interests at signup — your feed and digest personalise automatically.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-3 gap-px bg-rule border border-rule rounded-lg overflow-hidden">
          {FEATURES.map(({ icon, title, body }) => (
            <div key={title} className="bg-paper-raised p-7">
              <div className="w-10 h-10 rounded-md border border-rule flex items-center justify-center text-accent mb-5">
                {icon}
              </div>
              <h3 className="font-serif text-xl text-ink mb-2">{title}</h3>
              <p className="text-ink-soft text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-24 text-center">
        <div className="border-t border-rule pt-16 pb-4">
          <h2 className="font-serif text-4xl tracking-tight mb-3">
            Ready to stay informed?
          </h2>
          <p className="text-ink-soft text-base mb-8 max-w-sm mx-auto">
            Free to use. No credit card. Just a better way to follow the world.
          </p>
          <Link
            href="/auth"
            className="inline-block px-8 py-3.5 rounded-md bg-accent text-white font-medium text-sm hover:bg-accent-hover active:scale-[0.99] transition-all"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule px-6 py-6 max-w-5xl mx-auto flex items-center justify-between text-xs text-ink-faint">
        <span className="font-serif text-sm text-ink-soft">Briefed</span>
        <span>News updated 3× daily · Personalised digests · Free to use</span>
      </footer>

    </div>
  );
}
