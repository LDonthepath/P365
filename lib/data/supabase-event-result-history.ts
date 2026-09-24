import type { EconomicEventResult } from "../domain/event-result";
import {
  compareEconomicEventResultHistory,
  validateEconomicEventResultHistoryQuery,
} from "../repositories/event-result-history";
import type {
  EconomicEventResultHistoryQuery,
  HistoricalEconomicEventResultRepository,
} from "../repositories/types";

type MarketMemoryPayloadRow = {
  id: string;
  captured_at: string;
  payload: EconomicEventResult;
};

const DEFAULT_CANDIDATE_BATCH_SIZE = 100;
const DEFAULT_MAX_CANDIDATE_SCAN = 5_000;
const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

export type SupabaseHistoricalEconomicEventResultRepositoryOptions = {
  fetch?: typeof fetch;
  config: () => { url: string; key: string };
  candidateBatchSize?: number;
  maxCandidateScan?: number;
};

function isCanonicalEconomicEventResult(value: unknown): value is EconomicEventResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<EconomicEventResult>;
  return typeof result.id === "string"
    && typeof result.eventId === "string"
    && typeof result.retrievedAt === "string"
    && Number.isFinite(Date.parse(result.retrievedAt))
    && typeof result.sourceId === "string"
    && typeof result.evidenceId === "string"
    && (result.eventIdentityKey === undefined || typeof result.eventIdentityKey === "string")
    && (result.expected === undefined || (typeof result.expected === "number" && Number.isFinite(result.expected)))
    && (result.expectedType === undefined || ["FORECAST", "CONSENSUS", "OFFICIAL_PROJECTION"].includes(result.expectedType));
}

export class SupabaseHistoricalEconomicEventResultRepository
implements HistoricalEconomicEventResultRepository {
  private readonly fetcher: typeof fetch;
  private readonly config: () => { url: string; key: string };
  private readonly candidateBatchSize: number;
  private readonly maxCandidateScan: number;

  constructor(options: SupabaseHistoricalEconomicEventResultRepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.config = options.config;
    this.candidateBatchSize = options.candidateBatchSize ?? DEFAULT_CANDIDATE_BATCH_SIZE;
    this.maxCandidateScan = options.maxCandidateScan ?? DEFAULT_MAX_CANDIDATE_SCAN;
    if (!Number.isInteger(this.candidateBatchSize) || this.candidateBatchSize < 1) {
      throw new Error("EventResult history candidate batch size must be a positive integer.");
    }
    if (!Number.isInteger(this.maxCandidateScan) || this.maxCandidateScan < this.candidateBatchSize) {
      throw new Error("EventResult history candidate scan limit must be an integer at least as large as its batch size.");
    }
  }

  async findHistory(query: EconomicEventResultHistoryQuery): Promise<EconomicEventResult[]> {
    const bounds = validateEconomicEventResultHistoryQuery(query);
    const config = this.config();
    const capturedAtOnOrBefore = new Date().toISOString();
    const baseParams = new URLSearchParams({
      select: "id,captured_at,payload",
      record_type: "eq.EVENT_RESULT",
      "payload->>eventIdentityKey": "eq." + query.eventIdentityKey,
      captured_at: "lte." + capturedAtOnOrBefore,
      order: "captured_at.asc,id.asc",
    });
    if (query.sourceId !== undefined) {
      baseParams.set("payload->>sourceId", "eq." + query.sourceId);
    }
    if (query.expectedType !== undefined) {
      baseParams.set("payload->>expectedType", "eq." + query.expectedType);
    }

    const results: EconomicEventResult[] = [];
    let offset = 0;

    while (offset < this.maxCandidateScan) {
      const batchSize = Math.min(this.candidateBatchSize, this.maxCandidateScan - offset);
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
          "Supabase EventResult history read failed (" + response.status + "): " + detail,
        );
      }

      const rows = (await response.json()) as MarketMemoryPayloadRow[];
      for (const row of rows) {
        if (!isCanonicalEconomicEventResult(row.payload)) continue;
        const result = row.payload;
        if (
          result.eventIdentityKey !== query.eventIdentityKey
          || (query.sourceId !== undefined && result.sourceId !== query.sourceId)
          || (query.expectedType !== undefined && result.expectedType !== query.expectedType)
        ) {
          throw new Error(
            "Supabase EventResult history returned a record outside the requested identity/provenance.",
          );
        }

        const retrievedAt = Date.parse(result.retrievedAt);
        if (
          (bounds.from === undefined || retrievedAt >= bounds.from)
          && (bounds.through === undefined || retrievedAt <= bounds.through)
        ) {
          results.push(result);
        }
      }

      if (rows.length < batchSize) {
        results.sort(compareEconomicEventResultHistory);
        if (query.order === "DESC") results.reverse();
        return results.slice(0, query.limit);
      }
      offset += rows.length;
    }

    throw new Error(
      "EventResult history candidate scan exceeded "
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
  return { url: SUPABASE_URL.replace(/\/$/, ""), key: SUPABASE_KEY };
}

export const supabaseHistoricalEconomicEventResultRepository =
  new SupabaseHistoricalEconomicEventResultRepository({ config: requireConfig });
