"use client";

import { TOPIC_COLORS, TOPIC_LABELS, type TopicFilter } from "@/types/map";

const TOPICS: TopicFilter[] = ["all", "politics", "economy", "conflict", "health", "climate", "tech"];

const FRESHNESS_OPTIONS: { days: number; label: string }[] = [
  { days: 1.5, label: "Today" },
  { days: 2,   label: "2d" },
  { days: 3,   label: "3d" },
  { days: 5,   label: "5d" },
];

interface TopicFilterProps {
  active: TopicFilter;
  onChange: (topic: TopicFilter) => void;
  hideRead: boolean;
  onToggleHideRead: () => void;
  hasReadPins: boolean;
  freshnessDays: number;
  onFreshnessChange: (days: number) => void;
  topicCounts: Record<string, number>;
}

export default function TopicFilter({
  active,
  onChange,
  hideRead,
  onToggleHideRead,
  hasReadPins,
  freshnessDays,
  onFreshnessChange,
  topicCounts,
}: TopicFilterProps) {
  const total = topicCounts["all"] ?? 0;

  return (
    <div className="absolute left-0 right-0 z-10 flex flex-col items-center gap-2 pointer-events-none" style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}>

      {/* Row 1: Topic pills — badge is inline so it never overflows the scroll container */}
      <div className="flex gap-2 overflow-x-auto px-4 pointer-events-auto no-scrollbar">
        {TOPICS.map((topic) => {
          const isActive = active === topic;
          const color = topic === "all" ? "#ffffff" : TOPIC_COLORS[topic];
          const count = topicCounts[topic] ?? 0;

          return (
            <button
              key={topic}
              onClick={() => onChange(topic)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                isActive
                  ? "text-zinc-900 border-transparent"
                  : "bg-zinc-900/80 backdrop-blur-sm border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
              style={isActive ? { backgroundColor: color } : {}}
            >
              {TOPIC_LABELS[topic]}

              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full leading-none ${
                    isActive ? "bg-zinc-900/30 text-zinc-900" : "bg-red-500 text-white"
                  }`}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}

        {hasReadPins && (
          <button
            onClick={onToggleHideRead}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              hideRead
                ? "bg-zinc-400 text-zinc-900 border-transparent"
                : "bg-zinc-900/80 backdrop-blur-sm border-zinc-600 text-zinc-400 hover:border-zinc-400"
            }`}
          >
            {hideRead ? "Showing unread" : "Hide read"}
          </button>
        )}
      </div>

      {/* Row 2: Freshness filter — total count on each pill makes changes unmistakable */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        {FRESHNESS_OPTIONS.map(({ days, label }) => {
          const isActive = freshnessDays === days;
          return (
            <button
              key={days}
              onClick={() => onFreshnessChange(days)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? "bg-zinc-200 text-zinc-900 border-transparent"
                  : "bg-zinc-900/70 backdrop-blur-sm border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {label}
              {/* Total pin count — makes it obvious the number changes as you switch windows */}
              {isActive && total > 0 && (
                <span className="text-[9px] font-bold text-zinc-600">
                  {total}
                </span>
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
