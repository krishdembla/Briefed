"use client";

const REQUIRED = 3;

interface CheckInStripProps {
  readCount: number;
  streak: number;
  checkinFailed?: boolean;
}

export default function CheckInStrip({ readCount, streak, checkinFailed }: CheckInStripProps) {
  const done = readCount >= REQUIRED;
  const dots = Array.from({ length: REQUIRED }, (_, i) => i < readCount);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className={`flex items-center gap-3 bg-zinc-900/90 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg ${checkinFailed ? "border-red-700" : "border-zinc-700"}`}>
        <div className="flex gap-1.5">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                filled ? "bg-white scale-110" : "bg-zinc-600"
              }`}
            />
          ))}
        </div>

        <span className="text-xs font-medium text-zinc-300">
          {checkinFailed
            ? "Check-in failed — will retry"
            : done
            ? "Daily check-in complete"
            : `Read ${REQUIRED - readCount} more to check in`}
        </span>

        {done && !checkinFailed && <span className="text-xs">🎉</span>}

        {streak > 0 && (
          <>
            <div className="w-px h-3 bg-zinc-700" />
            <span className="text-xs font-semibold text-orange-400">
              🔥 {streak} {streak === 1 ? "day" : "days"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
