import type { Evidence } from "../domain/types";
import {
  compareEvidenceHistory,
  evidenceHistoryEffectiveAt,
  validateEvidenceHistoryQuery,
} from "../repositories/evidence-history";
import type {
  EvidenceHistoryQuery,
  HistoricalEvidenceRepository,
} from "../repositories/types";

type MarketMemoryEvidenceRow = {
  id: string;
  effective_at: string;
  payload: Evidence;
};

const DEFAULT_CANDIDATE_BATCH_SIZE = 250;
const DEFAULT_MAX_CANDIDATE_SCAN = 5_000;
const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

export type SupabaseHistoricalEvidenceRepositoryOptions = {
  fetch?: typeof fetch;
  config: () => { url: string; key: string };
  candidateBatchSize?: number;
  maxCandidateScan?: number;
};

function isCanonicalEvidence(value: unknown): value is Evidence {
  if (!value || typeof value !== "object") return false;
  const evidence = value as Partial<Evidence>;
  return typeof evidence.id === "string"
    && typeof evidence.sourceId === "string"
    && ["NEWS", "OBSERVATION", "EVENT"].includes(evidence.kind ?? "")
    && typeof evidence.subject === "string"
    && typeof evidence.content === "string"
    && typeof evidence.capturedAt === "string"
    && Number.isFinite(Date.parse(evidence.capturedAt))
    && typeof evidence.retrievedAt === "string"
    && Number.isFinite(Date.parse(evidence.retrievedAt))
    && (evidence.publishedAt === undefined || Number.isFinite(Date.parse(evidence.publishedAt)))
    && (evidence.releasedAt === undefined || Number.isFinite(Date.parse(evidence.releasedAt)));
}

export class SupabaseHistoricalEvidenceRepository
implements HistoricalEvidenceRepository {
  private readonly fetcher: typeof fetch;
  private readonly config: () => { url: string; key: string };
  private readonly candidateBatchSize: number;
  private readonly maxCandidateScan: number;

  constructor(options: SupabaseHistoricalEvidenceRepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.config = options.config;
    this.candidateBatchSize = options.candidateBatchSize ?? DEFAULT_CANDIDATE_BATCH_SIZE;
    this.maxCandidateScan = options.maxCandidateScan ?? DEFAULT_MAX_CANDIDATE_SCAN;
    if (!Number.isInteger(this.candidateBatchSize) || this.candidateBatchSize < 1) {
      throw new Error("Evidence history candidate batch size must be a positive integer.");
    }
    if (!Number.isInteger(this.maxCandidateScan) || this.maxCandidateScan < this.candidateBatchSize) {
      throw new Error(
        "Evidence history candidate scan limit must be an integer at least as large as its batch size.",
      );
    }
  }

  async findHistory(query: EvidenceHistoryQuery, options?: { signal?: AbortSignal }): Promise<Evidence[]> {
    const bounds = validateEvidenceHistoryQuery(query);
    const { url, key } = this.config();
    const direction = query.order.toLowerCase();
    const baseParams = new URLSearchParams({
      select: "id,effective_at,payload",
      record_type: "eq.EVIDENCE",
      order: `effective_at.${direction},id.${direction}`,
    });

    if (query.evidenceId !== undefined) {
      baseParams.set("canonical_id", `eq.${query.evidenceId}`);
    }
    if (query.sourceId !== undefined) {
      baseParams.set("payload->>sourceId", `eq.${query.sourceId}`);
    }
    if (query.kind !== undefined) {
      baseParams.set("payload->>kind", `eq.${query.kind}`);
    }
    for (const [metadataKey, value] of Object.entries(query.metadataEquals ?? {})) {
      baseParams.set(`payload->metadata->>${metadataKey}`, `eq.${value}`);
    }
    if (query.effectiveAtOnOrAfter !== undefined) {
      baseParams.set(
        "effective_at",
        `gte.${new Date(query.effectiveAtOnOrAfter).toISOString()}`,
      );
    }
    if (query.effectiveAtOnOrBefore !== undefined) {
      baseParams.append(
        "effective_at",
        `lte.${new Date(query.effectiveAtOnOrBefore).toISOString()}`,
      );
    }

    const evidence: Evidence[] = [];
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
        `${url}/rest/v1/market_memory?${params.toString()}`,
        {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: "no-store",
          signal: options?.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS)])
            : AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Supabase Evidence history read failed (${response.status}): ${detail}`,
        );
      }

      const rows = (await response.json()) as MarketMemoryEvidenceRow[];
      for (const row of rows) {
        if (!isCanonicalEvidence(row.payload)) continue;
        const item = row.payload;
        if (query.evidenceId !== undefined && item.id !== query.evidenceId) {
          throw new Error("Supabase Evidence history returned an unexpected Evidence ID.");
        }
        if (Date.parse(row.effective_at) !== evidenceHistoryEffectiveAt(item)) {
          throw new Error(
            "Supabase Evidence history contains inconsistent effective_at and Evidence semantic time.",
          );
        }
        if (query.sourceId !== undefined && item.sourceId !== query.sourceId) {
          throw new Error("Supabase Evidence history returned an unexpected source.");
        }
        if (query.kind !== undefined && item.kind !== query.kind) {
          throw new Error("Supabase Evidence history returned an unexpected kind.");
        }
        for (const [metadataKey, value] of Object.entries(query.metadataEquals ?? {})) {
          if (item.metadata?.[metadataKey] !== value) {
            throw new Error(
              "Supabase Evidence history returned a record outside requested metadata filters.",
            );
          }
        }

        const effectiveAt = evidenceHistoryEffectiveAt(item);
        const retrievedAt = Date.parse(item.retrievedAt);
        if (
          (bounds.effectiveFrom === undefined || effectiveAt >= bounds.effectiveFrom)
          && (bounds.effectiveThrough === undefined || effectiveAt <= bounds.effectiveThrough)
          && (bounds.retrievedThrough === undefined || retrievedAt <= bounds.retrievedThrough)
        ) {
          evidence.push(item);
        }
      }

      evidence.sort(compareEvidenceHistory);
      if (query.order === "DESC") evidence.reverse();

      const boundary = evidence[query.limit - 1];
      const lastCandidate = rows.at(-1);
      if (boundary && lastCandidate) {
        const boundaryTime = evidenceHistoryEffectiveAt(boundary);
        const lastCandidateTime = Date.parse(lastCandidate.effective_at);
        const passedBoundary = query.order === "ASC"
          ? lastCandidateTime > boundaryTime
          : lastCandidateTime < boundaryTime;
        if (passedBoundary) return evidence.slice(0, query.limit);
      }

      if (rows.length < batchSize) return evidence.slice(0, query.limit);
      offset += rows.length;
    }

    throw new Error(
      `Evidence history candidate scan exceeded ${this.maxCandidateScan} rows before a correct bounded result could be proven.`,
    );
  }
}
