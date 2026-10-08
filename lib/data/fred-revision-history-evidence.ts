import "server-only";

import { MACRO_SERIES_REGISTRY } from "./macro-registry";
import type { Observation } from "../domain/types";
import type { FredRevisionEvidenceRow } from "../application/fred-revision-proof";

/**
 * OBS-FRED-001D: historical read adapter only. This is deliberately NOT
 * wired into ingestion, the proof engine, cron, or production metrics.
 * Neither captured_at (written by Node before POST) nor created_at
 * (Postgres transaction-start default) proves a global COMMIT order.
 */
export type FredHistoryEvidenceRecord = FredRevisionEvidenceRow & {
  /** DB transaction-start timestamp, NOT the commit timestamp. */
  createdAt: string;
  /** Matches the source field on the stored Market Memory row, or legacy NULL. */
  sourceColumn: "fred" | null;
};

export type FredHistoryEvidenceResult = {
  records: FredHistoryEvidenceRecord[];
  /** Indicates only that the capped SELECT was not truncated. */
  periodRowsetBounded: true;
  /** No implicit upgrade from complete rowset to proven concurrent history. */
  completeHistoricalOrderingProven: false;
  orderingProven: false;
  orderingStatus: "NOT_EVALUATED";
  timestampProvenance: "APPLICATION_CAPTURED_AT_DB_TRANSACTION_START_CREATED_AT";
  /** Receipt 001A currently supplies counts, not the actual inserted IDs. */
  insertedIdentityProven: false;
};

export type FredHistoryEvidenceQuery = {
  seriesId: string;
  observedAt: string;
};

export type FredHistoryEvidenceReaderOptions = {
  config: () => { url: string; key: string };
  fetch?: typeof fetch;
};

const MAX_HISTORY_ROWS = 64;
const MAX_FETCH_ROWS = MAX_HISTORY_ROWS + 1;
const REQUEST_TIMEOUT_MS = 7_000;
const REGISTERED_SERIES = new Set<string>(MACRO_SERIES_REGISTRY.map((s) => s.seriesId));

function rowObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function assertEvidenceRow(value: unknown, query: FredHistoryEvidenceQuery, period: string):
  FredHistoryEvidenceRecord {
  const raw = rowObject(value);
  const payload = rowObject(raw?.payload);
  const metadata = rowObject(payload?.metadata);
  const identity = payload?.identity === undefined || payload?.identity === null
    ? null
    : rowObject(payload.identity);
  const malformedModernIdentity = payload?.identity !== undefined
    && payload?.identity !== null && identity === null;
  const effective = safeDate(raw?.effective_at);
  const actualPeriod = safeDate(payload?.observedAt);
  const captured = safeDate(raw?.captured_at);
  const created = safeDate(raw?.created_at);

  if (!raw || !payload || !metadata
    || typeof raw.canonical_id !== "string" || !raw.canonical_id
    || typeof payload.id !== "string" || payload.id !== raw.canonical_id
    || payload.domain !== "MACRO"
    || payload.sourceId !== "fred"
    || (raw.source_id !== null && raw.source_id !== "fred")
    || metadata.seriesId !== query.seriesId
    || typeof metadata.unit !== "string" || !metadata.unit
    || typeof metadata.frequency !== "string" || !metadata.frequency
    || malformedModernIdentity
    || (identity && (identity.version !== "v1"
      || identity.seriesKey !== query.seriesId
      || typeof identity.measurementId !== "string"
      || !identity.measurementId
      || typeof identity.revisionFingerprint !== "string"
      || !identity.revisionFingerprint))
    || !effective || effective !== period || actualPeriod !== period
    || !captured || !created
    || typeof payload.value !== "string"
    || typeof payload.retrievedAt !== "string" || !safeDate(payload.retrievedAt)
    || typeof payload.evidenceId !== "string" || !payload.evidenceId
    || typeof payload.quality !== "string" || !payload.quality
    || typeof payload.subject !== "string" || !payload.subject) {
    throw new Error("FRED history evidence response failed canonical provenance validation");
  }

  return {
    observation: payload as Observation,
    // Keep the DB-returned timestamp without pretending it is commit order.
    capturedAt: captured,
    createdAt: created,
    sourceColumn: raw.source_id as "fred" | null,
  };
}

export class SupabaseFredRevisionHistoryEvidenceReader {
  private readonly config: FredHistoryEvidenceReaderOptions["config"];
  private readonly fetcher: typeof fetch;

  constructor(options: FredHistoryEvidenceReaderOptions) {
    this.config = options.config;
    this.fetcher = options.fetch ?? fetch;
  }

  async readPeriod(query: FredHistoryEvidenceQuery): Promise<FredHistoryEvidenceResult> {
    if (!REGISTERED_SERIES.has(query.seriesId)) {
      throw new Error("FRED revision read requires a registered seriesId");
    }
    // Requiring a canonical UTC instant avoids ambiguous YYYY-MM-DD/local-time reads.
    const period = safeDate(query.observedAt);
    if (!period || period !== query.observedAt
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(query.observedAt)) {
      throw new Error("FRED revision read requires canonical UTC observedAt");
    }

    const { url, key } = this.config();
    if (!/^https:\/\//.test(url) || !key) {
      throw new Error("FRED history evidence reader requires server-side configuration");
    }
    const params = new URLSearchParams({
      select: "canonical_id,source_id,captured_at,created_at,effective_at,payload",
      record_type: "eq.OBSERVATION",
      effective_at: "eq." + period,
      "payload->metadata->>seriesId": "eq." + query.seriesId,
      "payload->>sourceId": "eq.fred",
      order: "captured_at.desc,canonical_id.asc",
      limit: String(MAX_FETCH_ROWS),
    });

    // IMPORTANT: do not filter source_id=eq.fred: 823 legacy FRED rows
    // currently have source_id NULL and payload.sourceId = "fred".
    let response: Response;
    try {
      response = await this.fetcher(
        url.replace(/\/$/, "") + "/rest/v1/market_memory?" + params.toString(),
        {
          headers: { apikey: key, Authorization: "Bearer " + key },
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      throw new Error("FRED history evidence read unavailable");
    }
    if (!response.ok) {
      // Upstream response/error may contain confidential details. No raw logs.
      throw new Error("FRED history evidence read failed (" + response.status + ")");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("FRED history evidence response was not valid JSON");
    }
    if (!Array.isArray(payload) || payload.length >= MAX_FETCH_ROWS) {
      // Never silently classify truncated history as complete.
      throw new Error("FRED history evidence exceeded or violated strict 64-row bound");
    }

    const records = payload.map((item) => assertEvidenceRow(item, query, period));
    if (new Set(records.map((r) => r.observation.id)).size !== records.length) {
      throw new Error("FRED history evidence contained duplicate canonical identities");
    }
    return {
      records,
      periodRowsetBounded: true,
      completeHistoricalOrderingProven: false,
      orderingProven: false,
      orderingStatus: "NOT_EVALUATED",
      timestampProvenance: "APPLICATION_CAPTURED_AT_DB_TRANSACTION_START_CREATED_AT",
      insertedIdentityProven: false,
    };
  }
}
