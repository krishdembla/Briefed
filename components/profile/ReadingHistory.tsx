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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Reading history
        </p>
        {entries.length > 0 && (
          <span className="text-xs text-zinc-600">{entries.length} stories</span>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-xs text-zinc-600 py-2">
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
                  className="flex items-start gap-3 px-2.5 py-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors"
                >
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 leading-snug line-clamp-2">
                      {entry.pin.headline}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] text-zinc-600">·</span>
                      <span className="text-[10px] text-zinc-600">{timeAgo(entry.readAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {entries.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1.5"
            >
              {expanded ? "Show less" : `Show all ${entries.length} stories`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
