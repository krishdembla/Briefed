"use client";

import { useEffect, useState } from "react";
import { getReadHistory, type ReadHistoryEntry } from "@/lib/db/reads";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";

interface ReadingHistoryProps {
  userId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReadingHistory({ userId }: ReadingHistoryProps) {
  const [entries, setEntries] = useState<ReadHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getReadHistory(userId, 30).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [userId]);

  const visible = expanded ? entries : entries.slice(0, 5);

  return (
    <div className="bg-paper-raised border border-rule rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em]">
          Reading history
        </p>
        {entries.length > 0 && (
          <span className="text-xs text-ink-faint tnum">{entries.length} stories</span>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 rounded-full border-2 border-rule border-t-accent animate-spin" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-xs text-ink-faint py-2">
          Stories you mark as read will appear here.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            {visible.map((entry) => {
              if (!entry.pin) return null;
              const color = TOPIC_COLORS[entry.pin.topic ?? "other"] ?? TOPIC_COLORS.other;
              const label = TOPIC_LABELS[entry.pin.topic ?? "other"] ?? "Other";
              return (
                <div
                  key={entry.pinId}
                  className="flex items-start gap-3 px-2.5 py-2.5 rounded-md hover:bg-paper-sunken transition-colors"
                >
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[15px] text-ink leading-snug line-clamp-2">
                      {entry.pin.headline}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] text-ink-faint">·</span>
                      <span className="text-[10px] text-ink-faint tnum">{timeAgo(entry.readAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {entries.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full text-xs text-ink-soft hover:text-ink transition-colors py-1.5"
            >
              {expanded ? "Show less" : `Show all ${entries.length} stories`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
