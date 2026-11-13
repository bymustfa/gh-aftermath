export interface TimeWindow {
  from: string;
  to: string;
}

export type DeliveryScope = "repo" | "org" | "app";

export type FailureReason = "http_error" | "missing_response" | "failed_status";

export type StuckReason = "queued" | "in_progress";

export interface RepoRef {
  owner: string;
  name: string;
}

export interface HookRef {
  id: number;
  scope: "repo" | "org";
  active: boolean;
  events: string[];
  targetUrl: string;
  owner?: string;
  repo?: string;
  org?: string;
}

export interface RawDelivery {
  id: number;
  guid: string;
  deliveredAt: string | null;
  status: string;
  statusCode: number | null;
  event: string;
  action: string | null;
  redelivery: boolean;
  duration: number | null;
  hookId: number;
  scope: DeliveryScope;
  owner?: string;
  repo?: string;
  org?: string;
  targetUrl?: string;
}

export interface FlaggedDelivery extends RawDelivery {
  reason: FailureReason;
}

export interface RawRun {
  id: number;
  name: string;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  runStartedAt: string | null;
  event: string;
  headBranch: string;
  owner: string;
  repo: string;
}

export interface FlaggedRun extends RawRun {
  reason: StuckReason;
}

export interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  reset: string;
}

export interface ScanClient {
  listRepos(org: string): Promise<RepoRef[]>;
  listOrgHooks(org: string): Promise<HookRef[]>;
  listRepoHooks(owner: string, repo: string): Promise<HookRef[]>;
  listOrgDeliveries(org: string, hookId: number, window: TimeWindow): Promise<RawDelivery[]>;
  listRepoDeliveries(
    owner: string,
    repo: string,
    hookId: number,
    window: TimeWindow,
  ): Promise<RawDelivery[]>;
  listAppDeliveries(window: TimeWindow): Promise<RawDelivery[]>;
  listWorkflowRuns(org: string, window: TimeWindow): Promise<RawRun[]>;
  rateLimit(): Promise<RateLimitSnapshot | null>;
}

export interface RedeliverTarget {
  scope: DeliveryScope;
  owner?: string;
  repo?: string;
  org?: string;
  hookId?: number;
  deliveryId: number;
}

export interface RunTarget {
  owner: string;
  repo: string;
  runId: number;
}

export interface RecoveryClient {
  redeliver(target: RedeliverTarget): Promise<void>;
  cancelRun(target: RunTarget): Promise<void>;
  forceCancelRun(target: RunTarget): Promise<void>;
  rerun(target: RunTarget): Promise<void>;
}

export type Operation =
  | ({
      type: "redeliver";
    } & RedeliverTarget)
  | ({
      type: "cancel" | "force-cancel" | "rerun";
    } & RunTarget);

export interface ActionRequest {
  method: "POST";
  path: string;
}

export interface ActionRecord {
  id: string;
  type: Operation["type"];
  label: string;
  request: ActionRequest;
  dryRun: boolean;
  executed: boolean;
  ok: boolean;
  error?: string;
  at: string;
}

export interface ScanCounts {
  repositories: number;
  hooks: number;
  deliveriesSeen: number;
  failedDeliveries: number;
  stuckRuns: number;
}

export interface ScanResult {
  org: string;
  window: TimeWindow;
  scannedAt: string;
  deliveries: FlaggedDelivery[];
  runs: FlaggedRun[];
  warnings: string[];
  counts: ScanCounts;
}

export type ReportMode = "scan" | "dry-run" | "execute" | "mixed";

export interface Report {
  product: "gh-aftermath";
  version: string;
  generatedAt: string;
  demo: boolean;
  org: string;
  window: TimeWindow | null;
  mode: ReportMode;
  counts: ScanCounts & {
    planned: number;
    executed: number;
    succeeded: number;
    failed: number;
  };
  warnings: string[];
  deliveries: FlaggedDelivery[];
  runs: FlaggedRun[];
  actions: ActionRecord[];
}

export interface StuckOptions {
  now: Date;
  queuedThresholdMs: number;
  inProgressThresholdMs: number;
}
