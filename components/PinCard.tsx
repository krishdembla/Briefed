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

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden animate-modal-in"
        style={{ borderLeftColor: topicColor, borderLeftWidth: "3px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-6">
          {/* Top row: topic badge + region + close button */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: topicColor + "25", color: topicColor }}
              >
                {topicLabel}
              </span>
              {pin.region_label && (
                <span className="text-xs text-zinc-500">{pin.region_label}</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Headline */}
          <h2 className="text-white font-bold text-lg leading-snug mb-3">
            {pin.headline}
          </h2>

          {/* Summary */}
          {pin.summary && (
            <p className="text-zinc-400 text-sm leading-relaxed mb-5">{pin.summary}</p>
          )}

          {/* Stats */}
          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2.5"
                >
                  <p className="text-white text-xs font-medium leading-snug">{stat}</p>
                </div>
              ))}
            </div>
          )}

          {/* Footer: source / time + action */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-600">
              <a
                href={pin.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 underline underline-offset-2 transition-colors"
              >
                {pin.source_name}
              </a>
              {" "}· {timeAgo(pin.published_at)}
            </span>
            <button
              onClick={() => !isRead && onRead(pin.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isRead
                  ? "bg-zinc-700/60 text-zinc-500 cursor-default"
                  : "bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.97]"
              }`}
            >
              {isRead ? "Read ✓" : "Mark as read"}
            </button>
          </div>

          {/* Related pins */}
          {relatedPins.length > 0 && (
            <div className="mt-5 pt-4 border-t border-zinc-800">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                More on {topicLabel}
              </p>
              <div className="flex flex-col gap-1.5">
                {relatedPins.map((related) => (
                  <button
                    key={related.id}
                    onClick={() => onSelectRelated?.(related)}
                    className="flex items-start gap-2.5 text-left group w-full rounded-xl px-2.5 py-2 hover:bg-zinc-800/60 transition-colors"
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: topicColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-300 group-hover:text-white leading-snug line-clamp-2 transition-colors">
                        {related.headline}
                      </p>
                      {related.region_label && (
                        <p className="text-xs text-zinc-600 mt-0.5">{related.region_label}</p>
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
