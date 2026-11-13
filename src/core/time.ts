import type { RawDelivery, TimeWindow } from "./types.js";

const LOCAL_DATE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/;

export function parseUserTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A time window needs both a start and an end.");
  }
  const local = LOCAL_DATE.exec(trimmed);
  const iso = local
    ? `${local[1]}T${local[2]}:${local[3] ?? "00"}Z`
    : trimmed;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid time: ${value}`);
  }
  return date.toISOString();
}

export function parseWindow(from: string, to: string): TimeWindow {
  const start = parseUserTime(from);
  const end = parseUserTime(to);
  if (Date.parse(start) > Date.parse(end)) {
    throw new Error("Window start must be before window end.");
  }
  return { from: start, to: end };
}

export function isWithinWindow(iso: string | null | undefined, window: TimeWindow): boolean {
  if (!iso) return false;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return false;
  return time >= Date.parse(window.from) && time <= Date.parse(window.to);
}

export interface DeliveryPageSplit {
  keep: RawDelivery[];
  stop: boolean;
}

/**
 * Webhook deliveries are listed newest first. Keep rows whose timestamp
 * falls inside the window. A missing or invalid timestamp is not in the
 * window, and it does not stop paging. Stop once a row is older than the
 * window start.
 */
export function splitDeliveryPage(page: readonly RawDelivery[], window: TimeWindow): DeliveryPageSplit {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const keep: RawDelivery[] = [];
  let stop = false;
  for (const delivery of page) {
    if (!delivery.deliveredAt) continue;
    const time = Date.parse(delivery.deliveredAt);
    if (Number.isNaN(time)) continue;
    if (time < from) {
      stop = true;
      continue;
    }
    if (time <= to) keep.push(delivery);
  }
  return { keep, stop };
}

export function windowDurationMs(window: TimeWindow): number {
  return Date.parse(window.to) - Date.parse(window.from);
}

export function createdQualifier(window: TimeWindow): string {
  const from = new Date(window.from);
  from.setUTCDate(from.getUTCDate() - 1);
  const start = from.toISOString().slice(0, 10);
  const end = new Date(window.to).toISOString().slice(0, 10);
  return `${start}..${end}`;
}
