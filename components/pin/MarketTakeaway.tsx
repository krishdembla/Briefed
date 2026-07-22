"use client";

import { useState } from "react";
import type { MapPin } from "@/types/map";

interface TakeawayData {
  sector_label: string;
  takeaway_md: string;
}

interface MarketTakeawayProps {
  pin: MapPin;
  topicColor: string;
}

// Editorial "why this news matters to these tickers" note. Only renders for
// pins the classifier marked high-relevance with at least one whitelist ticker.
// Lazy-loaded and cached per pin, like the primer. Explains the causal read
// instead of drawing a chart — no price data provider dependency.
export default function MarketTakeaway({ pin, topicColor }: MarketTakeawayProps) {
  const tickers = pin.tickers ?? [];
  const visible = tickers.length > 0 && pin.market_relevance === "high";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TakeawayData | null>(null);
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
      const res = await fetch(`/api/pins/${pin.id}/market-takeaway`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TakeawayData;
      setData(json);
    } catch (err) {
      console.error("[MarketTakeaway] fetch failed:", err);
      setError("Couldn't load the market takeaway right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  const primaryTicker = tickers[0];
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(primaryTicker)}`;

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
            Market impact
          </span>
          <span className="font-serif italic text-[17px] text-ink group-hover:text-accent transition-colors">
            What this means for {tickers.slice(0, 2).join(", ")}
            {tickers.length > 2 ? "…" : ""}
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
            Market impact
          </p>
          {data && (
            <span className="text-[11px] text-ink-soft italic truncate">
              · {data.sector_label}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink bg-paper-sunken hover:bg-paper-sunken/80 border border-rule hover:border-rule-strong rounded-full px-3 py-1 transition-all"
          aria-label="Collapse market impact"
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

      {loading && <TakeawaySkeleton />}

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
          {/* First paragraph as italic-serif lede, rest as body — same editorial
              treatment as the primer so the sections feel consistent. */}
          <div className="text-[15px] text-ink leading-[1.7] space-y-3">
            {data.takeaway_md.split(/\n{2,}/).map((para, i) =>
              i === 0 ? (
                <p key={i} className="font-serif italic text-[16px] text-ink-soft">
                  {para.trim()}
                </p>
              ) : (
                <p key={i}>{para.trim()}</p>
              )
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-[0.15em]">
                Watch
              </span>
              {tickers.map((t, i) => (
                <span key={t} className="text-xs tnum text-ink-soft">
                  {i > 0 && <span className="text-ink-faint mr-1.5">·</span>}
                  <span className="font-medium">{t}</span>
                </span>
              ))}
            </div>
            <a
              href={tradingViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-soft hover:text-accent transition-colors flex items-center gap-1"
            >
              See on TradingView
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function TakeawaySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-paper-sunken rounded w-11/12" />
      <div className="h-3 bg-paper-sunken rounded w-full" />
      <div className="h-3 bg-paper-sunken rounded w-10/12" />
      <div className="h-3 bg-paper-sunken rounded w-9/12" />
    </div>
  );
}
