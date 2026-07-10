"use client";

import { TOPIC_COLORS, TOPIC_LABELS, type MapPin } from "@/types/map";

interface PinCardProps {
  pin: MapPin;
  isRead: boolean;
  onRead: (pinId: string) => void;
  onClose: () => void;
  relatedPins?: MapPin[];
  onSelectRelated?: (pin: MapPin) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PinCard({ pin, isRead, onRead, onClose, relatedPins = [], onSelectRelated }: PinCardProps) {
  const topicColor = TOPIC_COLORS[pin.topic ?? "other"] ?? TOPIC_COLORS.other;
  const topicLabel = TOPIC_LABELS[pin.topic ?? "other"] ?? "Other";
  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];
  const hasStats = stats.length > 0;

  return (
    <div
      className="fixed inset-0 z-20 flex items-end sm:items-center sm:justify-center sm:p-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-paper-raised rounded-t-2xl sm:rounded-lg shadow-2xl border border-rule overflow-y-auto max-h-[88svh] sm:max-h-[90vh] animate-modal-in"
        style={{ borderLeftColor: topicColor, borderLeftWidth: "3px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-rule-strong" />
        </div>

        <div className="px-5 pt-3 sm:pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">

          {/* Top row: topic badge + region + close */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: topicColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topicColor }} />
                {topicLabel}
              </span>
              {pin.region_label && (
                <span className="text-xs text-ink-faint">· {pin.region_label}</span>
              )}
              <span className="text-xs text-ink-faint tnum">· {timeAgo(pin.published_at)}</span>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-paper-sunken text-ink-soft hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Headline */}
          <h2 className="font-serif text-ink text-xl sm:text-2xl leading-[1.2] mb-3">
            {pin.headline}
          </h2>

          {/* Standfirst — italic serif dek */}
          {pin.why_it_matters && (
            <p className="font-serif italic text-base leading-snug text-ink-soft mb-4">
              {pin.why_it_matters}
            </p>
          )}

          {/* Summary */}
          {pin.summary && (
            <p className="text-ink text-[15px] leading-[1.7] mb-4">{pin.summary}</p>
          )}

          {/* Key facts — stats promoted to a proper block */}
          {hasStats && (
            <div className="mb-4 border border-rule rounded-lg overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-faint px-4 pt-3 pb-1">
                Key facts
              </p>
              <div className="divide-y divide-rule">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: topicColor }} />
                    <span className="text-sm text-ink leading-snug tnum">{stat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: source + action */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <a
              href={pin.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-soft hover:text-accent underline underline-offset-2 transition-colors truncate"
            >
              {pin.source_name}
            </a>
            <button
              onClick={() => !isRead && onRead(pin.id)}
              className={`shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isRead
                  ? "bg-paper-sunken text-ink-faint cursor-default"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]"
              }`}
            >
              {isRead ? "Read ✓" : "Mark as read"}
            </button>
          </div>

          {/* Related pins */}
          {relatedPins.length > 0 && (
            <div className="mt-5 pt-4 border-t border-rule">
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-2.5">
                More on {topicLabel}
              </p>
              <div className="flex flex-col gap-1.5">
                {relatedPins.map((related) => (
                  <button
                    key={related.id}
                    onClick={() => onSelectRelated?.(related)}
                    className="flex items-start gap-2.5 text-left group w-full rounded-md px-2.5 py-2 hover:bg-paper-sunken transition-colors"
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: topicColor }}
                    />
                    <div className="min-w-0">
                      <p className="font-serif text-[15px] text-ink group-hover:text-accent leading-snug line-clamp-2 transition-colors">
                        {related.headline}
                      </p>
                      {related.region_label && (
                        <p className="text-xs text-ink-faint mt-0.5">{related.region_label}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
