import Link from "next/link";

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

const TOPICS = [
  { label: "Politics", color: "#3b82f6" },
  { label: "Economy", color: "#22c55e" },
  { label: "Conflict", color: "#ef4444" },
  { label: "Health", color: "#ec4899" },
  { label: "Climate", color: "#14b8a6" },
  { label: "Tech", color: "#a855f7" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="text-white font-black text-lg tracking-tight">Briefed</span>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="text-sm font-semibold bg-white text-zinc-900 px-4 py-2 rounded-xl hover:bg-zinc-100 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Updated 3× daily from global sources
        </div>

        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05] mb-6">
          The world in{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            3 minutes
          </span>
        </h1>

        <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto mb-10">
          Briefed maps live global news as interactive pins and delivers a
          personalised morning digest — so you know what matters, every day.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all"
          >
            Start reading free →
          </Link>
          <Link
            href="/auth"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl border border-zinc-800 text-zinc-400 font-semibold text-sm hover:border-zinc-600 hover:text-white transition-all"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Topic pills preview */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest text-center mb-6">
            6 topics. One feed.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {TOPICS.map(({ label, color }) => (
              <span
                key={label}
                className="px-4 py-2 rounded-full text-sm font-semibold border"
                style={{
                  backgroundColor: color + "18",
                  borderColor: color + "50",
                  color,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-6">
            Pick your interests at signup — your feed and digest personalise automatically.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, title, body }) => (
            <div
              key={title}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6"
            >
              <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                {icon}
              </div>
              <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl px-8 py-14">
          <h2 className="text-3xl font-black tracking-tight mb-3">
            Ready to stay informed?
          </h2>
          <p className="text-zinc-500 text-sm mb-8 max-w-sm mx-auto">
            Free to use. No credit card. Just a better way to follow the world.
          </p>
          <Link
            href="/auth"
            className="inline-block px-8 py-3.5 rounded-2xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all"
          >
            Create your account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 px-6 py-6 max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-700">
        <span className="font-bold text-zinc-600">Briefed</span>
        <span>News updated 3× daily · Personalised digests · Free to use</span>
      </footer>

    </div>
  );
}
