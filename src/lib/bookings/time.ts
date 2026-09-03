/**
 * "HH:mm" -> minutes since midnight. Accepts hours past 23 (e.g. "25:30")
 * because lifeandsoul-bookings stores an overnight booking's endTime that
 * way — a Friday 23:00-02:00 booking's endTime is "26:00", not "02:00" —
 * so any overlap/ordering comparison here has to use this rather than a
 * plain Date/time-of-day parse, or a booking that runs past midnight would
 * look like it ends before it starts.
 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
