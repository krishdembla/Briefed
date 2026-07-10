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
  onNotInterested: (pinId: string) => void;
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

function readTime(summary: string | null): string | null {
  if (!summary) return null;
  const words = summary.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

interface ReactionCounts {
  like: number;
}

export default function FeedDetail({
  pin, isRead, isSaved, userId, relatedPins,
  onBack, onRead, onSaveToggle, onSelectRelated, onNotInterested,
}: FeedDetailProps) {
  const topicColor = TOPIC_COLORS[pin.topic ?? "other"] ?? TOPIC_COLORS.other;
  const topicLabel = TOPIC_LABELS[pin.topic ?? "other"] ?? "Other";
  const stats = [pin.stat_1, pin.stat_2, pin.stat_3].filter(Boolean) as string[];
  const mins = readTime(pin.summary);
  const [showPicker, setShowPicker] = useState(false);
  const [threadPins, setThreadPins] = useState<MapPin[]>([]);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({ like: 0 });
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [readCount, setReadCount] = useState<number>(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadPins([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReactionCounts({ like: 0 });
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
        setReactionCounts(data.counts ?? { like: 0 });
        setUserReaction(data.userReaction ?? null);
        setReadCount(data.readCount ?? 0);
      })
      .catch(() => {});
  }, [pin.id]);

  async function handleLike() {
    if (!userId) return;
    const isLiked = userReaction === "like";

    // Optimistic update
    setUserReaction(isLiked ? null : "like");
    setReactionCounts((prev) => ({ like: Math.max(0, prev.like + (isLiked ? -1 : 1)) }));

    try {
      const res = await fetch(`/api/pins/${pin.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: "like" }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Roll back on failure
      setUserReaction(isLiked ? "like" : null);
      setReactionCounts((prev) => ({ like: Math.max(0, prev.like + (isLiked ? 1 : -1)) }));
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
        return; // only skip dropdown on successful native share
      } catch {
        // fall through to dropdown (e.g. localhost NotAllowedError, user cancelled)
      }
    }
    setShowShareMenu((prev) => !prev);
  }

  const touchStartX = useRef(0);

  return (
    <div
      className="flex flex-col h-full bg-paper-raised relative"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (e.changedTouches[0].clientX - touchStartX.current > 60) onBack();
      }}
    >
      {/* Back bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-rule bg-paper-raised/90 backdrop-blur-md">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-rule" />
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] shrink-0"
          style={{ color: topicColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topicColor }} />
          {topicLabel}
        </span>
        {pin.region_label && (
          <span className="text-xs text-ink-faint truncate">{pin.region_label}</span>
        )}
        <span className="text-xs text-ink-faint ml-auto shrink-0 tnum">{timeAgo(pin.published_at)}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="font-serif text-ink text-[26px] sm:text-3xl leading-[1.15] mb-3">
          {pin.headline}
        </h2>

        {/* Standfirst — an italic serif dek, the way a newspaper leads. No label,
            no tinted box: reads editorial rather than machine-generated. */}
        {pin.why_it_matters && (
          <p className="font-serif italic text-lg leading-snug text-ink-soft mb-4">
            {pin.why_it_matters}
          </p>
        )}

        {/* Dateline */}
        <div className="flex items-center gap-2 text-[11px] text-ink-faint uppercase tracking-[0.12em] pb-4 mb-5 border-b border-rule">
          {pin.region_label && <span>{pin.region_label}</span>}
          {pin.region_label && <span>·</span>}
          <span className="tnum normal-case tracking-normal">{timeAgo(pin.published_at)}</span>
          {mins && <><span>·</span><span className="tnum normal-case tracking-normal">{mins}</span></>}
        </div>

        {/* The brief — the full summary, set as editorial body with a drop cap.
            This is the first place the reader sees the summary (the feed card no
            longer leaks it), so opening a story now delivers genuinely new copy. */}
        {pin.summary && (
          <p className="text-ink text-[15px] leading-[1.7] mb-5 first-letter:float-left first-letter:font-serif first-letter:text-5xl first-letter:leading-[0.82] first-letter:pr-2 first-letter:pt-0.5 first-letter:text-ink">
            {pin.summary}
          </p>
        )}

        {/* Key facts — the stats promoted from tiny chips to a proper block. */}
        {stats.length > 0 && (
          <div className="mb-5 border border-rule rounded-lg overflow-hidden">
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

        {/* Topic tags — fine-grained labels when available */}
        {pin.tags && pin.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {pin.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-ink-soft bg-paper-sunken border border-rule rounded-full px-2.5 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Like button + read count */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleLike}
            disabled={!userId}
            title={userReaction === "like" ? "Unlike" : "Like this story"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all tnum ${
              userReaction === "like"
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-rule bg-paper text-ink-faint hover:border-accent/30 hover:bg-accent/5 hover:text-accent disabled:cursor-default"
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill={userReaction === "like" ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {reactionCounts.like > 0 && <span>{reactionCounts.like}</span>}
          </button>
          {readCount > 1 && (
            <span className="ml-auto text-[11px] text-ink-faint tnum">
              {readCount.toLocaleString()} readers
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 py-4 border-t border-rule">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href={pin.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-soft hover:text-accent underline underline-offset-2 transition-colors truncate"
            >
              {pin.source_name}
            </a>
            {userId && (
              <button
                onClick={() => { onBack(); onNotInterested(pin.id); }}
                className="text-xs text-ink-faint hover:text-ink transition-colors shrink-0"
              >
                Not interested
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* Share button — native OS sheet on mobile, dropdown fallback on desktop */}
            <button
              onClick={handleShare}
              title="Share"
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-faint hover:text-ink hover:bg-paper-sunken transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>

            {/* Desktop fallback dropdown */}
            {showShareMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 bg-paper-raised border border-rule rounded-lg shadow-lg py-1.5 w-44">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${pin.headline} ${pinUrl(pin.id)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShareMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-soft hover:bg-paper-sunken transition-colors"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(pinUrl(pin.id))}&text=${encodeURIComponent(pin.headline)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShareMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-soft hover:bg-paper-sunken transition-colors"
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
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-soft hover:bg-paper-sunken transition-colors"
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
                    ? "text-accent bg-accent/10"
                    : "text-ink-faint hover:text-accent hover:bg-accent/10"
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
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isRead
                  ? "bg-paper-sunken text-ink-faint cursor-default"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]"
              }`}
            >
              {isRead ? "Read ✓" : "Mark as read"}
            </button>
          </div>
        </div>

        {threadPins.length > 0 && (
          <div className="mt-2 pt-4 border-t border-rule">
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-3">
              Story updates
            </p>
            <div className="flex flex-col gap-1.5">
              {threadPins.map((thread) => {
                const threadColor = TOPIC_COLORS[thread.topic ?? "other"] ?? TOPIC_COLORS.other;
                return (
                  <button
                    key={thread.id}
                    onClick={() => onSelectRelated(thread)}
                    className="flex items-start gap-2.5 text-left group w-full rounded-md px-2.5 py-2.5 hover:bg-paper-sunken border border-transparent hover:border-rule transition-all"
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: threadColor }}
                    />
                    <div className="min-w-0">
                      <p className="font-serif text-[15px] text-ink group-hover:text-accent leading-snug line-clamp-2 transition-colors">
                        {thread.headline}
                      </p>
                      <p className="text-[10px] text-ink-faint mt-0.5 tnum">
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
          <div className="mt-2 pt-4 border-t border-rule">
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-3">
              More on {topicLabel}
            </p>
            <div className="flex flex-col gap-1.5">
              {relatedPins.map((related) => (
                <button
                  key={related.id}
                  onClick={() => onSelectRelated(related)}
                  className="flex items-start gap-2.5 text-left group w-full rounded-md px-2.5 py-2.5 hover:bg-paper-sunken border border-transparent hover:border-rule transition-all"
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
