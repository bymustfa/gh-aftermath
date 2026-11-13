import { randomUUID } from "node:crypto";
import { mapPool } from "./pool.js";
import { actionLabel, actionPath } from "./paths.js";
import type { ActionRecord, Operation, RecoveryClient } from "./types.js";

export interface ExecuteOptions {
  dryRun: boolean;
  concurrency?: number;
  now?: Date;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Each action needs a ${key}.`);
  }
  return value.trim();
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Each action needs an integer ${key}.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer.`);
  }
  return value;
}

export function parseOperations(input: unknown): Operation[] {
  if (!Array.isArray(input)) {
    throw new Error("Actions must be a list.");
  }
  if (input.length > 500) {
    throw new Error("At most 500 actions can be submitted at once.");
  }
  return input.map((item) => {
    const record = asRecord(item);
    if (!record) throw new Error("Each action must be an object.");
    const type = requiredString(record, "type");
    if (type === "redeliver") {
      const scope = requiredString(record, "scope");
      if (scope !== "repo" && scope !== "org" && scope !== "app") {
        throw new Error("Webhook scope must be repo, org, or app.");
      }
      return {
        type: "redeliver",
        scope,
        owner: optionalString(record, "owner"),
        repo: optionalString(record, "repo"),
        org: optionalString(record, "org"),
        hookId: optionalNumber(record, "hookId"),
        deliveryId: requiredNumber(record, "deliveryId"),
      };
    }
    if (type === "cancel" || type === "force-cancel" || type === "rerun") {
      return {
        type,
        owner: requiredString(record, "owner"),
        repo: requiredString(record, "repo"),
        runId: requiredNumber(record, "runId"),
      };
    }
    throw new Error(`Unknown action type: ${type}`);
  });
}

async function perform(client: RecoveryClient, operation: Operation): Promise<void> {
  if (operation.type === "redeliver") {
    await client.redeliver({
      scope: operation.scope,
      owner: operation.owner,
      repo: operation.repo,
      org: operation.org,
      hookId: operation.hookId,
      deliveryId: operation.deliveryId,
    });
    return;
  }
  const target = { owner: operation.owner, repo: operation.repo, runId: operation.runId };
  if (operation.type === "cancel") {
    await client.cancelRun(target);
    return;
  }
  if (operation.type === "force-cancel") {
    await client.forceCancelRun(target);
    return;
  }
  await client.rerun(target);
}

export async function executeOperations(
  operations: readonly Operation[],
  client: RecoveryClient,
  options: ExecuteOptions,
): Promise<ActionRecord[]> {
  const concurrency = options.concurrency ?? 4;
  const now = options.now ?? new Date();
  return mapPool(operations, concurrency, async (operation) => {
    let request;
    try {
      request = actionPath(operation);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        id: randomUUID(),
        type: operation.type,
        label: operation.type,
        request: { method: "POST" as const, path: "" },
        dryRun: options.dryRun,
        executed: false,
        ok: false,
        error: message,
        at: now.toISOString(),
      };
    }

    const base = {
      id: randomUUID(),
      type: operation.type,
      label: actionLabel(operation),
      request,
      dryRun: options.dryRun,
      at: now.toISOString(),
    };

    if (options.dryRun) {
      return { ...base, executed: false, ok: true };
    }

    try {
      await perform(client, operation);
      return { ...base, executed: true, ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...base, executed: true, ok: false, error: message };
    }
  });
}
