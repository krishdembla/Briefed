"use client";

import { useEffect, useRef, useState } from "react";
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
  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];

  // Direction C: Progressive reveal — collapsed by default, expands on click
  const [expanded, setExpanded] = useState(false);

  // Direction A: track image load state — collapse the slot entirely on
  // failure rather than showing a placeholder, and fade the image in on load
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fire onActivate when this card scrolls into the centered viewport band.
  // Targets the card root div so collapse/expand never affects this behaviour.
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

  const showImage = !!(pin.og_image_url && !imageError);

  return (
    <div
      ref={ref}
      data-pin-id={pin.id}
      onClick={() => {
        if (!expanded) {
          setExpanded(true);
        } else {
          onOpen(pin);
        }
      }}
      className={`group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 border ${
        isActive
          ? "bg-white shadow-xl shadow-indigo-100/60 border-indigo-200 scale-[1.01]"
          : "bg-white/70 hover:bg-white border-zinc-200/70 hover:border-zinc-300 hover:shadow-md"
      } ${isRead ? "opacity-60" : ""}`}
      style={isActive ? { borderLeftColor: topicColor, borderLeftWidth: "4px" } : undefined}
    >
      {/* Direction A: OG image header (16:9). No slot is rendered at all when
          there's no image — articles without one go straight to the text
          content instead of showing an empty placeholder block. */}
      {showImage && (
        <div
          className="w-full aspect-video overflow-hidden"
          style={{ backgroundColor: topicColor + "14" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pin.og_image_url!}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      )}

      <div className="p-4">
        {/* Top row: topic chip + region + timestamp */}
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

        {/* Headline — always visible */}
        <h3 className="text-zinc-900 font-semibold text-[15px] leading-snug mb-2 line-clamp-3">
          {pin.headline}
        </h3>

        {/* Direction C: Expandable section */}
        {!expanded ? (
          /* Collapsed state: teaser prompt */
          <p className="text-[11px] text-zinc-400 group-hover:text-indigo-500 transition-colors">
            Tap to read more →
          </p>
        ) : (
          /* Expanded state: summary + why it matters + stats */
          <div onClick={(e) => e.stopPropagation()}>
            {pin.summary && (
              <p className="text-zinc-600 text-sm leading-relaxed line-clamp-4 mb-3">
                {pin.summary}
              </p>
            )}

            {/* Direction B: "Why it matters" callout */}
            {pin.why_it_matters && (
              <div
                className="rounded-xl px-3 py-2.5 mb-3 text-sm leading-snug"
                style={{ backgroundColor: topicColor + "12", borderLeft: `3px solid ${topicColor}` }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: topicColor }}>
                  Why it matters
                </span>
                <p className="text-zinc-700">{pin.why_it_matters}</p>
              </div>
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

            {/* Tap to open full detail */}
            <button
              onClick={() => onOpen(pin)}
              className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-1"
            >
              Open full story →
            </button>
          </div>
        )}

        {/* Footer: source + read indicator */}
        <div className="flex items-center justify-between text-[11px] pt-2 mt-1 border-t border-zinc-100">
          <span className="text-zinc-400 truncate">{pin.source_name}</span>
          {isRead && (
            <span className="text-emerald-500 font-semibold">Read ✓</span>
          )}
        </div>
      </div>
    </div>
  );
}
