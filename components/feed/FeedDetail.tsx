"use client";

import { useEffect, useRef, useState } from "react";
import { TOPIC_COLORS, TOPIC_LABELS, type MapPin } from "@/types/map";
import AlbumPicker from "./AlbumPicker";

interface FeedDetailProps {
  pin: MapPin;
  isRead: boolean;
  isSaved: boolean;
  userId: string | null;
  relatedPins: MapPin[];
  onBack: () => void;
  onRead: (pinId: string) => void;
  onSaveToggle: (isSaved: boolean) => void;
  onSelectRelated: (pin: MapPin) => void;
}

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

function pinUrl(pinId: string): string {
  return `${APP_URL}/pin/${pinId}`;
}

function copyPinUrl(pinId: string): void {
  const url = pinUrl(pinId);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface ReactionCounts {
  fire: number;
  complex: number;
  useful: number;
}

const REACTION_META: { key: keyof ReactionCounts; emoji: string; label: string }[] = [
  { key: "fire",    emoji: "🔥", label: "Big story" },
  { key: "complex", emoji: "🤔", label: "Complex"   },
  { key: "useful",  emoji: "💡", label: "Useful"    },
];

export default function FeedDetail({
  pin, isRead, isSaved, userId, relatedPins,
  onBack, onRead, onSaveToggle, onSelectRelated,
}: FeedDetailProps) {
  const topicColor = TOPIC_COLORS[pin.topic ?? "other"] ?? TOPIC_COLORS.other;
  const topicLabel = TOPIC_LABELS[pin.topic ?? "other"] ?? "Other";
  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];
  const [showPicker, setShowPicker] = useState(false);
  const [threadPins, setThreadPins] = useState<MapPin[]>([]);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Direction D: reactions + read count
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({ fire: 0, complex: 0, useful: 0 });
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [readCount, setReadCount] = useState<number>(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadPins([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReactionCounts({ fire: 0, complex: 0, useful: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserReaction(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadCount(0);

    fetch(`/api/pins/${pin.id}/related`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setThreadPins)
      .catch(() => {});

    fetch(`/api/pins/${pin.id}/reactions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setReactionCounts(data.counts ?? { fire: 0, complex: 0, useful: 0 });
        setUserReaction(data.userReaction ?? null);
        setReadCount(data.readCount ?? 0);
      })
      .catch(() => {});
  }, [pin.id]);

  async function handleReaction(reaction: string) {
    if (!userId) return;
    const optimisticPrev = userReaction;
    const isToggleOff = userReaction === reaction;

    // Optimistic update
    setUserReaction(isToggleOff ? null : reaction);
    setReactionCounts((prev) => {
      const next = { ...prev };
      if (optimisticPrev && optimisticPrev in next) {
        next[optimisticPrev as keyof ReactionCounts] = Math.max(0, next[optimisticPrev as keyof ReactionCounts] - 1);
      }
      if (!isToggleOff) {
        next[reaction as keyof ReactionCounts]++;
      }
      return next;
    });

    try {
      const res = await fetch(`/api/pins/${pin.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Roll back on failure
      setUserReaction(optimisticPrev);
      setReactionCounts((prev) => {
        const next = { ...prev };
        if (optimisticPrev && optimisticPrev in next) next[optimisticPrev as keyof ReactionCounts]++;
        if (!isToggleOff) next[reaction as keyof ReactionCounts] = Math.max(0, next[reaction as keyof ReactionCounts] - 1);
        return next;
      });
    }
  }

  // Direction: native OS share sheet on mobile (covers WhatsApp, Instagram, iMessage,
  // etc. for free); explicit WhatsApp/Telegram/Copy dropdown on desktop where
  // navigator.share isn't supported.
  async function handleShare() {
    const url = pinUrl(pin.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: pin.headline, url });
      } catch {
        // User cancelled the native sheet — no-op
      }
      return;
    }
    setShowShareMenu((prev) => !prev);
  }

  const touchStartX = useRef(0);

  return (
    <div
      className="flex flex-col h-full bg-white relative"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (e.changedTouches[0].clientX - touchStartX.current > 60) onBack();
      }}
    >
      {/* Back bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-200 bg-white/80 backdrop-blur-md"
        style={{ borderBottomColor: topicColor + "40" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-zinc-200" />
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: topicColor + "1f", color: topicColor }}
        >
          {topicLabel}
        </span>
        {pin.region_label && (
          <span className="text-xs text-zinc-500 truncate">{pin.region_label}</span>
        )}
        <span className="text-xs text-zinc-400 ml-auto shrink-0">{timeAgo(pin.published_at)}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-zinc-900 font-bold text-lg leading-snug mb-3">
          {pin.headline}
        </h2>

        {pin.summary && (
          <p className="text-zinc-600 text-sm leading-relaxed mb-4">{pin.summary}</p>
        )}

        {/* Direction B: Why it matters callout */}
        {pin.why_it_matters && (
          <div
            className="rounded-xl px-3.5 py-3 mb-4 text-sm leading-snug"
            style={{ backgroundColor: topicColor + "12", borderLeft: `3px solid ${topicColor}` }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider block mb-1"
              style={{ color: topicColor }}
            >
              Why it matters
            </span>
            <p className="text-zinc-700">{pin.why_it_matters}</p>
          </div>
        )}

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {stats.map((stat, i) => (
              <span
                key={i}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700"
              >
                {stat}
              </span>
            ))}
          </div>
        )}

        {/* Direction D: Reactions + read count */}
        <div className="flex items-center gap-2 mb-4">
          {REACTION_META.map(({ key, emoji, label }) => {
            const count = reactionCounts[key];
            const isActive = userReaction === key;
            return (
              <button
                key={key}
                onClick={() => handleReaction(key)}
                title={label}
                disabled={!userId}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 disabled:cursor-default"
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
          {readCount > 1 && (
            <span className="ml-auto text-[11px] text-zinc-400">
              {readCount.toLocaleString()} readers
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 py-4 border-t border-zinc-100">
          <a
            href={pin.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-indigo-600 underline underline-offset-2 transition-colors truncate"
          >
            {pin.source_name}
          </a>
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* Share button — native OS sheet on mobile, dropdown fallback on desktop */}
            <button
              onClick={handleShare}
              title="Share"
              className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>

            {/* Desktop fallback dropdown */}
            {showShareMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5 w-44">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${pin.headline} ${pinUrl(pin.id)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShareMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(pinUrl(pin.id))}&text=${encodeURIComponent(pin.headline)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShareMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Telegram
                  </a>
                  <button
                    onClick={() => {
                      copyPinUrl(pin.id);
                      setCopied(true);
                      setShowShareMenu(false);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </>
            )}

            {/* Save button — only shown when user is signed in */}
            {userId && (
              <button
                onClick={() => setShowPicker(true)}
                title={isSaved ? "Saved" : "Save to collection"}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                  isSaved
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                <svg
                  className="w-4.5 h-4.5"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={() => !isRead && onRead(pin.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isRead
                  ? "bg-zinc-100 text-zinc-400 cursor-default"
                  : "bg-zinc-900 text-white hover:bg-zinc-700 active:scale-[0.97]"
              }`}
            >
              {isRead ? "Read ✓" : "Mark as read"}
            </button>
          </div>
        </div>

        {threadPins.length > 0 && (
          <div className="mt-2 pt-4 border-t border-zinc-100">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Story updates
            </p>
            <div className="flex flex-col gap-1.5">
              {threadPins.map((thread) => {
                const threadColor = TOPIC_COLORS[thread.topic ?? "other"] ?? TOPIC_COLORS.other;
                return (
                  <button
                    key={thread.id}
                    onClick={() => onSelectRelated(thread)}
                    className="flex items-start gap-2.5 text-left group w-full rounded-xl px-2.5 py-2.5 hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all"
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: threadColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-800 group-hover:text-zinc-900 leading-snug line-clamp-2 transition-colors">
                        {thread.headline}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {thread.region_label && `${thread.region_label} · `}
                        {timeAgo(thread.published_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {relatedPins.length > 0 && (
          <div className="mt-2 pt-4 border-t border-zinc-100">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              More on {topicLabel}
            </p>
            <div className="flex flex-col gap-1.5">
              {relatedPins.map((related) => (
                <button
                  key={related.id}
                  onClick={() => onSelectRelated(related)}
                  className="flex items-start gap-2.5 text-left group w-full rounded-xl px-2.5 py-2.5 hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all"
                >
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: topicColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 group-hover:text-zinc-900 leading-snug line-clamp-2 transition-colors">
                      {related.headline}
                    </p>
                    {related.region_label && (
                      <p className="text-xs text-zinc-500 mt-0.5">{related.region_label}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Album picker sheet — slides up from bottom within FeedDetail */}
      {showPicker && userId && (
        <AlbumPicker
          pinId={pin.id}
          userId={userId}
          onClose={() => setShowPicker(false)}
          onSavedChange={(saved) => {
            onSaveToggle(saved);
            if (!saved) setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}
