"use client";

import { useEffect, useRef, useState } from "react";
import { TOPIC_COLORS, TOPIC_LABELS, type MapPin } from "@/types/map";

interface FeedCardProps {
  pin: MapPin;
  isRead: boolean;
  isActive: boolean;
  onActivate: (pinId: string) => void;
  onOpen: (pin: MapPin) => void;
  onNotInterested: (pinId: string) => void;
  scrollRoot: HTMLElement | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Rough read-time from the summary (~200 wpm). Falls back to null when there's
// no summary so we simply omit it rather than showing "0 min".
function readTime(summary: string | null): string | null {
  if (!summary) return null;
  const words = summary.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default function FeedCard({ pin, isRead, isActive, onActivate, onOpen, onNotInterested, scrollRoot }: FeedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const topicColor = TOPIC_COLORS[pin.topic ?? "other"];
  const topicLabel = TOPIC_LABELS[pin.topic ?? "other"];
  const mins = readTime(pin.summary);

  const [showMenu, setShowMenu] = useState(false);

  // Track image load state — omit the thumbnail entirely on failure so a broken
  // image never shows; the row simply renders text-only (clean, intentional).
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fire onActivate when this card scrolls into the centered viewport band.
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

  // A single tap opens the full detail — the slim card is a pure list item, no
  // inline expand (that duplicated the detail view and leaked its content).
  return (
    <div
      ref={ref}
      data-pin-id={pin.id}
      onClick={() => onOpen(pin)}
      className={`group cursor-pointer transition-colors border-l-2 ${
        isActive
          ? "bg-paper-raised"
          : "border-l-transparent hover:bg-paper-raised/70"
      } ${isRead ? "opacity-55" : ""}`}
      style={isActive ? { borderLeftColor: topicColor } : undefined}
    >
      <div className="flex gap-3.5 px-4 py-3.5">
        {/* Text column */}
        <div className="flex-1 min-w-0">
          {/* Meta row: topic + region + time + overflow menu */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] shrink-0"
              style={{ color: topicColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topicColor }} />
              {topicLabel}
            </span>
            {pin.region_label && (
              <span className="text-[11px] text-ink-faint truncate">· {pin.region_label}</span>
            )}
            <span className="text-[11px] text-ink-faint tnum ml-auto shrink-0 pl-1">{timeAgo(pin.published_at)}</span>
            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-5 h-5 flex items-center justify-center rounded-full text-ink-faint hover:text-ink hover:bg-paper-sunken transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="More options"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-paper-raised border border-rule rounded-lg shadow-lg py-1 w-40">
                    <button
                      onClick={() => { setShowMenu(false); onNotInterested(pin.id); }}
                      className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-sm text-ink-soft hover:bg-paper-sunken transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                      </svg>
                      Not interested
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Headline — serif, 2 lines */}
          <h3 className="font-serif text-ink text-[15px] leading-[1.3] line-clamp-2 group-hover:text-accent transition-colors">
            {pin.headline}
          </h3>

          {/* Footer meta: source · read-time · read state */}
          <div className="flex items-center gap-1.5 text-[11px] text-ink-faint mt-1.5">
            <span className="truncate">{pin.source_name}</span>
            {mins && <><span>·</span><span className="shrink-0 tnum">{mins}</span></>}
            {isRead && <span className="ml-auto shrink-0 text-accent font-medium">Read ✓</span>}
          </div>
        </div>

        {/* Thumbnail — small fixed square on the right. Omitted entirely when the
            article has no usable image, so the row is clean text-only. */}
        {showImage && (
          <div
            className="w-24 h-24 rounded-md overflow-hidden shrink-0"
            style={{ backgroundColor: topicColor + "12" }}
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
      </div>
    </div>
  );
}
