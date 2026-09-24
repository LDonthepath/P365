import type { MarketSnapshot } from "../domain/market-snapshot";
import {
  compareMarketSnapshotHistory,
  validateMarketSnapshotHistoryQuery,
} from "../repositories/snapshot-history";
import type {
  HistoricalMarketSnapshotRepository,
  MarketSnapshotHistoryQuery,
} from "../repositories/types";

type MarketMemorySnapshotRow = {
  id: string;
  effective_at: string;
  payload: MarketSnapshot;
};

const DEFAULT_CANDIDATE_BATCH_SIZE = 100;
const DEFAULT_MAX_CANDIDATE_SCAN = 5_000;

export type SupabaseHistoricalMarketSnapshotRepositoryOptions = {
  fetch?: typeof fetch;
  config: () => { url: string; key: string };
  candidateBatchSize?: number;
  maxCandidateScan?: number;
};

function postgrestQuoted(value: string): string {
  return '"' + value.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
}

function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MarketSnapshot>;
  return typeof snapshot.id === "string"
    && snapshot.version === "v1"
    && typeof snapshot.capturedAt === "string"
    && Number.isFinite(Date.parse(snapshot.capturedAt))
    && typeof snapshot.scope === "string"
    && Array.isArray(snapshot.observationRefs)
    && Array.isArray(snapshot.eventRefs)
    && Array.isArray(snapshot.baselineRefs)
    && Array.isArray(snapshot.stateRefs)
    && Array.isArray(snapshot.sourceHealthRefs)
    && Array.isArray(snapshot.requirements)
    && Array.isArray(snapshot.missingRequirements)
    && ["COMPLETE", "PARTIAL", "STALE", "UNKNOWN"].includes(snapshot.quality ?? "");
}

export class SupabaseHistoricalMarketSnapshotRepository
implements HistoricalMarketSnapshotRepository {
  private readonly fetcher: typeof fetch;
  private readonly config: () => { url: string; key: string };
  private readonly candidateBatchSize: number;
  private readonly maxCandidateScan: number;

  constructor(options: SupabaseHistoricalMarketSnapshotRepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.config = options.config;
    this.candidateBatchSize = options.candidateBatchSize ?? DEFAULT_CANDIDATE_BATCH_SIZE;
    this.maxCandidateScan = options.maxCandidateScan ?? DEFAULT_MAX_CANDIDATE_SCAN;
    if (!Number.isInteger(this.candidateBatchSize) || this.candidateBatchSize < 1) {
      throw new Error("Snapshot history candidate batch size must be a positive integer.");
    }
    if (!Number.isInteger(this.maxCandidateScan) || this.maxCandidateScan < this.candidateBatchSize) {
      throw new Error(
        "Snapshot history candidate scan limit must be an integer at least as large as its batch size.",
      );
    }
  }

  async findHistory(query: MarketSnapshotHistoryQuery): Promise<MarketSnapshot[]> {
    const bounds = validateMarketSnapshotHistoryQuery(query);
    const config = this.config();
    const baseParams = new URLSearchParams({
      select: "id,effective_at,payload",
      record_type: "eq.SNAPSHOT",
      "payload->>scope": "eq." + postgrestQuoted(query.scope),
      order: "effective_at.asc,id.asc",
    });
    if (query.capturedAtOnOrAfter !== undefined) {
      baseParams.append("effective_at", "gte." + new Date(bounds.from!).toISOString());
    }
    if (query.capturedAtOnOrBefore !== undefined) {
      baseParams.append("effective_at", "lte." + new Date(bounds.through!).toISOString());
    }

    const results: MarketSnapshot[] = [];
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
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          "Supabase Market Snapshot history read failed ("
          + response.status
          + "): "
          + detail,
        );
      }

      const rows = (await response.json()) as MarketMemorySnapshotRow[];
      for (const row of rows) {
        if (!isMarketSnapshot(row.payload)) continue;
        if (row.payload.scope !== query.scope) {
          throw new Error(
            "Supabase Snapshot history returned a record outside the requested scope.",
          );
        }
        const capturedAt = Date.parse(row.payload.capturedAt);
        if (
          (bounds.from === undefined || capturedAt >= bounds.from)
          && (bounds.through === undefined || capturedAt <= bounds.through)
        ) {
          results.push(row.payload);
        }
      }

      if (rows.length < batchSize) {
        results.sort(compareMarketSnapshotHistory);
        if (query.order === "DESC") results.reverse();
        return results.slice(0, query.limit);
      }

      offset += rows.length;
    }

    throw new Error(
      "Snapshot history candidate scan exceeded "
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

export const supabaseHistoricalMarketSnapshotRepository =
  new SupabaseHistoricalMarketSnapshotRepository({ config: requireConfig });
