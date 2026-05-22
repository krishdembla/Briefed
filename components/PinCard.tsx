"use client";

import { TOPIC_COLORS, TOPIC_LABELS, type MapPin } from "@/types/map";

interface PinCardProps {
  pin: MapPin;
  isRead: boolean;
  onRead: (pinId: string) => void;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PinCard({ pin, isRead, onRead, onClose }: PinCardProps) {
  const topicColor = TOPIC_COLORS[pin.topic ?? "other"] ?? TOPIC_COLORS.other;
  const topicLabel = TOPIC_LABELS[pin.topic ?? "other"] ?? "Other";
  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
      <div className="mx-auto max-w-2xl">
        <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl shadow-2xl">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-zinc-600" />
          </div>

          <div className="px-5 pb-5 pt-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: topicColor + "30", color: topicColor }}
                  >
                    {topicLabel}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {pin.source_name} · {timeAgo(pin.published_at)}
                  </span>
                  {pin.region_label && (
                    <span className="text-xs text-zinc-500">· {pin.region_label}</span>
                  )}
                </div>
                <h2 className="text-white font-semibold text-base leading-snug line-clamp-3">
                  {pin.headline}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-zinc-500 hover:text-white transition-colors mt-0.5"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary */}
            {pin.summary && (
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">{pin.summary}</p>
            )}

            {/* Stats */}
            {stats.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-white text-xs font-medium leading-snug">{stat}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Action */}
            <button
              onClick={() => !isRead && onRead(pin.id)}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isRead
                  ? "bg-zinc-700 text-zinc-400 cursor-default"
                  : "bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.98]"
              }`}
            >
              {isRead ? "Read ✓" : "Mark as read"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
