import type { Event } from "../domain/types";
import {
  compareEventHistory,
  validateEventHistoryQuery,
} from "../repositories/event-history";
import type {
  EventHistoryQuery,
  HistoricalEventRepository,
} from "../repositories/types";

type MarketMemoryEventRow = {
  id: string;
  captured_at: string;
  payload: Event;
};

const DEFAULT_CANDIDATE_BATCH_SIZE = 200;
const DEFAULT_MAX_CANDIDATE_SCAN = 5_000;
const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

export type SupabaseHistoricalEventRepositoryOptions = {
  fetch?: typeof fetch;
  config: () => { url: string; key: string };
  candidateBatchSize?: number;
  maxCandidateScan?: number;
};

function isCanonicalEvent(value: unknown): value is Event {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<Event>;
  return typeof event.id === "string"
    && typeof event.subject === "string"
    && typeof event.description === "string"
    && typeof event.retrievedAt === "string"
    && Number.isFinite(Date.parse(event.retrievedAt))
    && typeof event.status === "string"
    && typeof event.importance === "string"
    && typeof event.sourceId === "string"
    && typeof event.evidenceId === "string"
    && (event.scheduledAt === undefined || Number.isFinite(Date.parse(event.scheduledAt)))
    && (
      event.identity === undefined
      || (
        event.identity.version === "v1"
        && typeof event.identity.key === "string"
        && typeof event.identity.semanticKey === "string"
        && Number.isFinite(Date.parse(event.identity.scheduledAt))
      )
    );
}

function scheduledAt(event: Event): number | null {
  const value = event.identity?.scheduledAt ?? event.scheduledAt;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabaseHistoricalEventRepository
implements HistoricalEventRepository {
  private readonly fetcher: typeof fetch;
  private readonly config: () => { url: string; key: string };
  private readonly candidateBatchSize: number;
  private readonly maxCandidateScan: number;

  constructor(options: SupabaseHistoricalEventRepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.config = options.config;
    this.candidateBatchSize = options.candidateBatchSize ?? DEFAULT_CANDIDATE_BATCH_SIZE;
    this.maxCandidateScan = options.maxCandidateScan ?? DEFAULT_MAX_CANDIDATE_SCAN;
    if (!Number.isInteger(this.candidateBatchSize) || this.candidateBatchSize < 1) {
      throw new Error("Event history candidate batch size must be a positive integer.");
    }
    if (!Number.isInteger(this.maxCandidateScan) || this.maxCandidateScan < this.candidateBatchSize) {
      throw new Error(
        "Event history candidate scan limit must be an integer at least as large as its batch size.",
      );
    }
  }

  async findHistory(query: EventHistoryQuery): Promise<Event[]> {
    const bounds = validateEventHistoryQuery(query);
    const config = this.config();
    const baseParams = new URLSearchParams({
      select: "id,captured_at,payload",
      record_type: "eq.EVENT",
      order: "captured_at.asc,id.asc",
    });

    if (query.eventIdentityKey !== undefined) {
      baseParams.set(
        "payload->identity->>key",
        "eq." + query.eventIdentityKey,
      );
    }
    if (query.importance !== undefined) {
      baseParams.set(
        "payload->>importance",
        "eq." + query.importance,
      );
    }

    const events: Event[] = [];
    let offset = 0;

    while (offset < this.maxCandidateScan) {
      const batchSize = Math.min(
        this.candidateBatchSize,
        this.maxCandidateScan - offset,
      );
      const params = new URLSearchParams(baseParams);
      params.set("limit", String(batchSize));
      params.set("offset", String(offset));

      const response = await this.fetcher(
        config.url + "/rest/v1/market_memory?" + params.toString(),
        {
          headers: {
            apikey: config.key,
            Authorization: "Bearer " + config.key,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          "Supabase Event history read failed ("
          + response.status
          + "): "
          + detail,
        );
      }

      const rows = (await response.json()) as MarketMemoryEventRow[];
      for (const row of rows) {
        if (!isCanonicalEvent(row.payload)) continue;
        const event = row.payload;

        if (
          query.eventIdentityKey !== undefined
          && event.identity?.key !== query.eventIdentityKey
        ) {
          throw new Error(
            "Supabase Event history returned a record outside the requested Event identity.",
          );
        }
        if (
          query.importance !== undefined
          && event.importance !== query.importance
        ) {
          throw new Error(
            "Supabase Event history returned a record outside the requested importance.",
          );
        }

        const schedule = scheduledAt(event);
        if (schedule === null) continue;
        const retrievedAt = Date.parse(event.retrievedAt);

        if (
          (bounds.scheduledFrom === undefined || schedule >= bounds.scheduledFrom)
          && (bounds.scheduledThrough === undefined || schedule <= bounds.scheduledThrough)
          && (bounds.retrievedThrough === undefined || retrievedAt <= bounds.retrievedThrough)
        ) {
          events.push(event);
        }
      }

      if (rows.length < batchSize) {
        events.sort(compareEventHistory);
        if (query.order === "DESC") events.reverse();
        return events.slice(0, query.limit);
      }

      offset += rows.length;
    }

    throw new Error(
      "Event history candidate scan exceeded "
      + this.maxCandidateScan
      + " rows before a complete result could be proven.",
    );
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.P365_MEMORY_WRITE_KEY ?? process.env.SUPABASE_SECRET_KEY;

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "P365 durable Market Memory requires SUPABASE_URL and a server-only Supabase write key.",
    );
  }
  return {
    url: SUPABASE_URL.replace(/\/$/, ""),
    key: SUPABASE_KEY,
  };
}

export const supabaseHistoricalEventRepository =
  new SupabaseHistoricalEventRepository({ config: requireConfig });
