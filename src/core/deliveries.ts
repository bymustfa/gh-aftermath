import type { FailureReason, RawDelivery } from "./types.js";

const OK_STATUSES = new Set(["ok", "success"]);

export interface DeliveryClassification {
  failed: boolean;
  reason: FailureReason | null;
}

export function classifyDelivery(delivery: Pick<RawDelivery, "status" | "statusCode">): DeliveryClassification {
  const code = delivery.statusCode;
  if (code === null || code === undefined || code === 0) {
    return { failed: true, reason: "missing_response" };
  }
  if (code >= 400) {
    return { failed: true, reason: "http_error" };
  }
  const status = delivery.status.trim().toLowerCase();
  if (status && !OK_STATUSES.has(status)) {
    return { failed: true, reason: "failed_status" };
  }
  return { failed: false, reason: null };
}

export function isFailedOrMissingDelivery(delivery: Pick<RawDelivery, "status" | "statusCode">): boolean {
  return classifyDelivery(delivery).failed;
}
