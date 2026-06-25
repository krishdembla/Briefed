"use client";

import { useEffect, useRef } from "react";
import { TOPIC_COLORS, TOPIC_LABELS, type MapPin } from "@/types/map";

interface FeedCardProps {
  pin: MapPin;
  isRead: boolean;
  isActive: boolean;
  onActivate: (pinId: string) => void;
  onOpen: (pin: MapPin) => void;
  scrollRoot: HTMLElement | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FeedCard({ pin, isRead, isActive, onActivate, onOpen, scrollRoot }: FeedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const topicColor = TOPIC_COLORS[pin.topic ?? "other"];
  const topicLabel = TOPIC_LABELS[pin.topic ?? "other"];

  // Fire onActivate when this card scrolls into the centered viewport band.
  // rootMargin shrinks the observer window to the middle ~30% of the panel,
  // so only the card the user is actually reading triggers the map fly-to.
  useEffect(() => {
    if (!ref.current || !scrollRoot) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onActivate(pin.id);
        }
      },
      { root: scrollRoot, rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pin.id, onActivate, scrollRoot]);

  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];

  return (
    <div
      ref={ref}
      data-pin-id={pin.id}
      onClick={() => onOpen(pin)}
      className={`group cursor-pointer rounded-2xl p-5 transition-all duration-300 border ${
        isActive
          ? "bg-white shadow-xl shadow-indigo-100/60 border-indigo-200 scale-[1.01]"
          : "bg-white/70 hover:bg-white border-zinc-200/70 hover:border-zinc-300 hover:shadow-md"
      } ${isRead ? "opacity-60" : ""}`}
      style={isActive ? { borderLeftColor: topicColor, borderLeftWidth: "4px" } : undefined}
    >
      {/* Top row: topic chip + meta */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: topicColor + "1f", color: topicColor }}
          >
            {topicLabel}
          </span>
          {pin.region_label && (
            <span className="text-[11px] text-zinc-500 truncate">{pin.region_label}</span>
          )}
        </div>
        <span className="text-[11px] text-zinc-400 shrink-0">{timeAgo(pin.published_at)}</span>
      </div>

      {/* Headline */}
      <h3 className="text-zinc-900 font-semibold text-[15px] leading-snug mb-2 line-clamp-3">
        {pin.headline}
      </h3>

      {/* Summary */}
      {pin.summary && (
        <p className="text-zinc-600 text-sm leading-relaxed line-clamp-3 mb-3">
          {pin.summary}
        </p>
      )}

      {/* Stats chips */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {stats.slice(0, 2).map((stat, i) => (
            <span
              key={i}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200"
            >
              {stat}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] pt-1">
        <span className="text-zinc-400 truncate">{pin.source_name}</span>
        <span className={`font-semibold transition-colors ${
          isActive ? "text-indigo-600" : "text-zinc-400 group-hover:text-indigo-600"
        }`}>
          Read →
        </span>
      </div>
    </div>
  );
}
