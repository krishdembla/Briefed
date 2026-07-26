"use client";

const REQUIRED = 3;

interface CheckInStripProps {
  readCount: number;
  streak: number;
  checkinFailed?: boolean;
  // When rendered on the mobile map view above the floating tab pill, the
  // strip needs extra bottom padding so the two don't collide.
  elevated?: boolean;
}

export default function CheckInStrip({ readCount, streak, checkinFailed, elevated }: CheckInStripProps) {
  const done = readCount >= REQUIRED;
  const dots = Array.from({ length: REQUIRED }, (_, i) => i < readCount);

  const bottomOffset = elevated ? "4.5rem" : "1rem";

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none" style={{ paddingBottom: `calc(${bottomOffset} + env(safe-area-inset-bottom, 0px))` }}>
      <div
        className="flex items-center gap-3 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg pointer-events-auto"
        style={{
          backgroundColor: "rgba(28, 26, 23, 0.92)",
          borderColor: checkinFailed ? "#9e4a3c" : "rgba(255,255,255,0.14)",
        }}
      >
        <div className="flex gap-1.5">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                filled ? "bg-paper scale-110" : "bg-white/25"
              }`}
            />
          ))}
        </div>

        <span className="text-xs font-medium text-white/85">
          {checkinFailed
            ? "Check-in failed — will retry"
            : done
            ? "Daily check-in complete"
            : `Read ${REQUIRED - readCount} more to check in`}
        </span>

        {streak > 0 && (
          <>
            <div className="w-px h-3 bg-white/20" />
            <span className="text-xs font-semibold tnum" style={{ color: "#d19a52" }}>
              {streak} {streak === 1 ? "day" : "days"} streak
            </span>
          </>
        )}
      </div>
    </div>
  );
}
