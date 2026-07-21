"use client";

import { useState } from "react";

interface PrimerSource {
  id: string;
  headline: string;
  published_at: string;
  source_name: string;
  source_url: string;
}

type PrimerMode =
  | "from_coverage"
  | "hybrid"
  | "background_only"
  | "no_backstory";

interface PrimerData {
  primer_md: string;
  mode: PrimerMode;
  sources: PrimerSource[];
}

interface PinPrimerProps {
  pinId: string;
  topicColor: string;
}

// "What led to this?" — collapsed by default, expands on click, fetches lazily
// and streams into the modal. Cached server-side per pin so repeat opens are
// instant.
export default function PinPrimer({ pinId, topicColor }: PinPrimerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PrimerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    if (data || loading) {
      setOpen(true);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pins/${pinId}/primer`, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json = (await res.json()) as PrimerData;
      setData(json);
    } catch (err) {
      console.error("[PinPrimer] fetch failed:", err);
      setError("Couldn't load the background right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  // No-backstory outcome collapses back to a quiet single-line aside — we don't
  // want to render a whole "Background" section for a story that doesn't merit one.
  const isNoBackstory = data?.mode === "no_backstory";

  if (isNoBackstory && data) {
    return (
      <p className="mt-5 pt-4 border-t border-rule text-sm font-serif italic text-ink-faint leading-snug">
        {data.primer_md}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-5 pt-4 border-t border-rule mb-5">
        <button
          onClick={handleOpen}
          className="group flex items-center gap-2.5 text-left"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: topicColor }}
            aria-hidden="true"
          />
          <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] group-hover:text-accent transition-colors">
            Background
          </span>
          <span className="font-serif italic text-[17px] text-ink group-hover:text-accent transition-colors">
            What led to this?
          </span>
          <span
            className="text-ink-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all text-sm"
            aria-hidden="true"
          >
            →
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 pt-4 border-t border-rule mb-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: topicColor }}
            aria-hidden="true"
          />
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em]">
            Background
          </p>
          {data && data.mode === "background_only" && (
            <span className="text-[10px] text-ink-faint italic truncate">
              · General knowledge
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink bg-paper-sunken hover:bg-paper-sunken/80 border border-rule hover:border-rule-strong rounded-full px-3 py-1 transition-all"
          aria-label="Collapse background"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          Hide
        </button>
      </div>

      {loading && <PrimerSkeleton />}

      {error && !loading && (
        <div className="text-sm text-ink-soft">
          <p>{error}</p>
          <button
            onClick={handleOpen}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* First paragraph gets italic-serif lede treatment, remaining paragraphs
              set as editorial body. Reads like a newspaper background piece, not
              an assistant card. */}
          <div className="text-[15px] text-ink leading-[1.7] space-y-3">
            {data.primer_md.split(/\n{2,}/).map((para, i) =>
              i === 0 ? (
                <p key={i} className="font-serif italic text-[16px] text-ink-soft">
                  {para.trim()}
                </p>
              ) : (
                <p key={i}>{para.trim()}</p>
              )
            )}
          </div>

          {data.sources.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-2">
                Based on prior coverage
              </p>
              <ul className="space-y-1">
                {data.sources.map((s) => (
                  <li key={s.id} className="text-xs leading-snug">
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-soft hover:text-accent underline underline-offset-2 decoration-rule-strong hover:decoration-accent"
                    >
                      {s.headline}
                    </a>
                    <span className="text-ink-faint">
                      {" · "}
                      {s.source_name} · {s.published_at.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PrimerSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-paper-sunken rounded w-11/12" />
      <div className="h-3 bg-paper-sunken rounded w-full" />
      <div className="h-3 bg-paper-sunken rounded w-10/12" />
      <div className="h-3 bg-paper-sunken rounded w-9/12" />
    </div>
  );
}
