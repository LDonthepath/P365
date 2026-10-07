import type { Observation } from "../domain/types";
import { compareObservationHistory, observationSemanticSeriesKey, validateObservationHistoryQuery } from "../repositories/observation-history";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";

type MarketMemoryPayloadRow = { id: string; effective_at: string; payload: Observation };

const DEFAULT_CANDIDATE_BATCH_SIZE = 250;
const DEFAULT_MAX_CANDIDATE_SCAN = 5_000;
const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;
const OBSERVATION_HISTORY_RPC = "p365_observation_history_candidates_v1";

export type SupabaseHistoricalObservationRepositoryOptions = {
  fetch?: typeof fetch;
  config: () => { url: string; key: string };
  candidateBatchSize?: number;
  maxCandidateScan?: number;
};

function isCanonicalObservation(value: unknown): value is Observation {
  if (!value || typeof value !== "object") return false;
  const observation = value as Partial<Observation>;
  return typeof observation.id === "string"
    && typeof observation.domain === "string"
    && typeof observation.subject === "string"
    && typeof observation.value === "string"
    && typeof observation.observedAt === "string"
    && Number.isFinite(Date.parse(observation.observedAt))
    && typeof observation.retrievedAt === "string"
    && Number.isFinite(Date.parse(observation.retrievedAt))
    && typeof observation.sourceId === "string"
    && typeof observation.quality === "string"
    && typeof observation.evidenceId === "string";
}

export class SupabaseHistoricalObservationRepository implements HistoricalObservationRepository {
  private readonly fetcher: typeof fetch;
  private readonly config: () => { url: string; key: string };
  private readonly candidateBatchSize: number;
  private readonly maxCandidateScan: number;

  constructor(options: SupabaseHistoricalObservationRepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.config = options.config;
    this.candidateBatchSize = options.candidateBatchSize ?? DEFAULT_CANDIDATE_BATCH_SIZE;
    this.maxCandidateScan = options.maxCandidateScan ?? DEFAULT_MAX_CANDIDATE_SCAN;
    if (!Number.isInteger(this.candidateBatchSize) || this.candidateBatchSize < 1) {
      throw new Error("Observation history candidate batch size must be a positive integer.");
    }
    if (!Number.isInteger(this.maxCandidateScan) || this.maxCandidateScan < this.candidateBatchSize) {
      throw new Error("Observation history candidate scan limit must be an integer at least as large as its batch size.");
    }
  }

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    const { retrievedThrough } = validateObservationHistoryQuery(query);
    const { url, key } = this.config();
    const capturedAtOnOrBefore = new Date().toISOString();
    const observedAtOnOrAfter = query.observedAtOnOrAfter === undefined
      ? null
      : new Date(query.observedAtOnOrAfter).toISOString();
    const observedAtOnOrBefore = query.observedAtOnOrBefore === undefined
      ? null
      : new Date(query.observedAtOnOrBefore).toISOString();

    const observations: Observation[] = [];
    let offset = 0;
    while (offset < this.maxCandidateScan) {
      const batchSize = Math.min(this.candidateBatchSize, this.maxCandidateScan - offset);
      const response = await this.fetcher(
        `${url}/rest/v1/rpc/${OBSERVATION_HISTORY_RPC}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_domain: query.identity.domain,
            p_series_key: query.identity.seriesKey,
            p_source_id: query.sourceId ?? null,
            p_observed_at_on_or_after: observedAtOnOrAfter,
            p_observed_at_on_or_before: observedAtOnOrBefore,
            p_captured_at_on_or_before: capturedAtOnOrBefore,
            p_sort_desc: query.order === "DESC",
            p_limit: batchSize,
            p_offset: offset,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase Observation history read failed (${response.status}): ${detail}`);
      }

      const rows = (await response.json()) as MarketMemoryPayloadRow[];
      for (const row of rows) {
        if (!isCanonicalObservation(row.payload)) continue;
        if (Date.parse(row.effective_at) !== Date.parse(row.payload.observedAt)) {
          throw new Error("Supabase Observation history contains inconsistent effective_at and Observation.observedAt values.");
        }
        if (
          row.payload.domain !== query.identity.domain
          || observationSemanticSeriesKey(row.payload) !== query.identity.seriesKey
          || (query.sourceId !== undefined && row.payload.sourceId !== query.sourceId)
        ) {
          throw new Error("Supabase Observation history returned a record outside the requested semantic identity.");
        }
        if (retrievedThrough === undefined || Date.parse(row.payload.retrievedAt) <= retrievedThrough) {
          observations.push(row.payload);
        }
      }

      observations.sort(compareObservationHistory);
      if (query.order === "DESC") observations.reverse();
      const boundary = observations[query.limit - 1];
      const lastCandidate = rows.at(-1);
      if (boundary && lastCandidate) {
        const boundaryTime = Date.parse(boundary.observedAt);
        const lastCandidateTime = Date.parse(lastCandidate.effective_at);
        const passedBoundary = query.order === "ASC"
          ? lastCandidateTime > boundaryTime
          : lastCandidateTime < boundaryTime;
        // Do not stop inside an observedAt tie group. Every revision at the
        // requested limit boundary must be validated before final ordering.
        if (passedBoundary) return observations.slice(0, query.limit);
      }
      if (rows.length < batchSize) return observations.slice(0, query.limit);
      offset += rows.length;
    }

    throw new Error(`Observation history candidate scan exceeded ${this.maxCandidateScan} rows before a correct bounded result could be proven.`);
  }
}
