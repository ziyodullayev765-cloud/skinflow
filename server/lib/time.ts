/** All periods are computed in UTC so every user shares the same reset time. */
export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodKey(period: "daily" | "weekly" | "once", d = new Date()): string {
  if (period === "daily") return utcDateKey(d);
  if (period === "weekly") return isoWeekKey(d);
  return "once";
}

export function nextUtcMidnight(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

export function levelForXp(xp: number): number {
  // Smooth curve: level n requires 50 * n * (n - 1) XP.
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2));
}

export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}
