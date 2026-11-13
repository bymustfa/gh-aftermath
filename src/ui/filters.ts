import { logicSource } from "./logic-source.js";

export interface ListQuery {
  query: string;
  repository: string;
  event: string;
  status: string;
}

export interface DeliveryFilterRow {
  id: number;
  event: string;
  action?: string | null;
  status?: string;
  statusCode?: number | null;
  reason?: string;
  scope: string;
  owner?: string;
  repo?: string;
  org?: string;
  targetUrl?: string;
  guid?: string;
}

export interface RunFilterRow {
  id: number;
  name: string;
  displayTitle?: string;
  status: string;
  event: string;
  headBranch?: string;
  owner: string;
  repo: string;
  reason?: string;
}

export interface FilterChoices {
  repositories: string[];
  events: string[];
  statuses: string[];
}

interface LogicApi {
  normalizeListQuery: (query: Partial<ListQuery> | null | undefined) => ListQuery;
  deliveryPlace: (delivery: { scope: string; owner?: string; repo?: string; org?: string }) => string;
  deliveryResult: (delivery: { reason?: string; statusCode?: number | null; status?: string }) => string;
  runPlace: (run: { owner: string; repo: string }) => string;
  distinctSorted: (values: readonly string[]) => string[];
  filterDeliveries: (items: readonly DeliveryFilterRow[], query: Partial<ListQuery> | null | undefined) => DeliveryFilterRow[];
  filterRuns: (items: readonly RunFilterRow[], query: Partial<ListQuery> | null | undefined) => RunFilterRow[];
  deliveryChoices: (items: readonly DeliveryFilterRow[]) => FilterChoices;
  runChoices: (items: readonly RunFilterRow[]) => FilterChoices;
  idsInFilteredSelection: (
    items: readonly { id: number }[],
    visible: readonly { id: number }[],
    selected: ReadonlySet<number>,
  ) => number[];
}

function loadLogic(): LogicApi {
  const runner = new Function(
    `${logicSource}\nreturn { normalizeListQuery, deliveryPlace, deliveryResult, runPlace, distinctSorted, filterDeliveries, filterRuns, deliveryChoices, runChoices, idsInFilteredSelection };`,
  ) as () => LogicApi;
  return runner();
}

const logic = loadLogic();

export function normalizeListQuery(query: Partial<ListQuery> | null | undefined): ListQuery {
  return logic.normalizeListQuery(query);
}

export function deliveryPlace(delivery: { scope: string; owner?: string; repo?: string; org?: string }): string {
  return logic.deliveryPlace(delivery);
}

export function deliveryResult(delivery: { reason?: string; statusCode?: number | null; status?: string }): string {
  return logic.deliveryResult(delivery);
}

export function runPlace(run: { owner: string; repo: string }): string {
  return logic.runPlace(run);
}

export function distinctSorted(values: readonly string[]): string[] {
  return logic.distinctSorted(values);
}

export function filterDeliveries<T extends DeliveryFilterRow>(
  items: readonly T[],
  query: Partial<ListQuery> | null | undefined,
): T[] {
  return logic.filterDeliveries(items, query) as T[];
}

export function filterRuns<T extends RunFilterRow>(
  items: readonly T[],
  query: Partial<ListQuery> | null | undefined,
): T[] {
  return logic.filterRuns(items, query) as T[];
}

export function deliveryChoices(items: readonly DeliveryFilterRow[]): FilterChoices {
  return logic.deliveryChoices(items);
}

export function runChoices(items: readonly RunFilterRow[]): FilterChoices {
  return logic.runChoices(items);
}

export function idsInFilteredSelection(
  items: readonly { id: number }[],
  visible: readonly { id: number }[],
  selected: ReadonlySet<number>,
): number[] {
  return logic.idsInFilteredSelection(items, visible, selected);
}
