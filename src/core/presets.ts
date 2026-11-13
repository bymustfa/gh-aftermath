export interface UtcDateTimeLocal {
  from: string;
  to: string;
}

/** UTC field text, minute precision. This is the value shown and the value sent. */
export function toUtcDateTimeLocal(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** Window ending at `now` and reaching back `hours` hours, in UTC. */
export function hoursWindow(now: Date, hours: number): UtcDateTimeLocal {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Preset length must be a positive number of hours.");
  }
  const end = new Date(now);
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { from: toUtcDateTimeLocal(start), to: toUtcDateTimeLocal(end) };
}
