// Computes the current consecutive-day streak from an array of completed check-in dates (YYYY-MM-DD).
// Does not count today — used in nudge emails sent before the user has checked in.
export function computeStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const dateSet = new Set(completedDates);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (!dateSet.has(yesterday)) return 0;

  let streak = 0;
  let cursor = new Date(yesterday);
  while (true) {
    const d = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(d)) break;
    streak++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}
