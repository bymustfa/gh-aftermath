export interface UtcDateTimeLocal {
  from: string;
  to: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** UTC `datetime-local` value, minute precision, no timezone suffix. */
export function toUtcDateTimeLocal(date: Date): string {
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
