import type { Observation } from "../domain/types";
import { compareObservationHistory, observationSemanticSeriesKey, validateObservationHistoryQuery } from "../repositories/observation-history";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";

type MarketMemoryPayloadRow = { effective_at: string; payload: Observation };

export type SupabaseHistoricalObservationRepositoryOptions = {
  fetch?: typeof fetch;
  config: () => { url: string; key: string };
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

function postgrestQuoted(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export class SupabaseHistoricalObservationRepository implements HistoricalObservationRepository {
  private readonly fetcher: typeof fetch;
  private readonly config: () => { url: string; key: string };

  constructor(options: SupabaseHistoricalObservationRepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.config = options.config;
  }

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    validateObservationHistoryQuery(query);
    const { url, key } = this.config();
    const direction = query.order.toLowerCase();
    const params = new URLSearchParams({
      select: "effective_at,payload",
      record_type: "eq.OBSERVATION",
      "payload->>domain": `eq.${query.identity.domain}`,
      or: `(payload->metadata->>seriesId.eq.${postgrestQuoted(query.identity.seriesKey)},payload->metadata->>metricId.eq.${postgrestQuoted(query.identity.seriesKey)})`,
      "payload->>observedAt": "not.is.null",
      "payload->>retrievedAt": "not.is.null",
      "payload->>id": "not.is.null",
      "payload->>subject": "not.is.null",
      "payload->>value": "not.is.null",
      "payload->>sourceId": "not.is.null",
      "payload->>quality": "not.is.null",
      "payload->>evidenceId": "not.is.null",
      order: `effective_at.${direction},payload->>retrievedAt.${direction},payload->>id.${direction}`,
      limit: String(query.limit),
    });
    if (query.sourceId !== undefined) params.set("payload->>sourceId", `eq.${postgrestQuoted(query.sourceId)}`);
    if (query.observedAtOnOrAfter !== undefined) params.set("effective_at", `gte.${new Date(query.observedAtOnOrAfter).toISOString()}`);
    if (query.observedAtOnOrBefore !== undefined) params.append("effective_at", `lte.${new Date(query.observedAtOnOrBefore).toISOString()}`);
    if (query.retrievedAtOnOrBefore !== undefined) {
      params.set("payload->>retrievedAt", `lte.${new Date(query.retrievedAtOnOrBefore).toISOString()}`);
    }

    const response = await this.fetcher(`${url}/rest/v1/market_memory?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase Observation history read failed (${response.status}): ${detail}`);
    }

    const rows = (await response.json()) as MarketMemoryPayloadRow[];
    const observations = rows.map((row) => {
      if (!isCanonicalObservation(row.payload)) return null;
      if (Date.parse(row.effective_at) !== Date.parse(row.payload.observedAt)) {
        throw new Error("Supabase Observation history contains inconsistent effective_at and Observation.observedAt values.");
      }
      return row.payload;
    }).filter((observation): observation is Observation => observation !== null);
    for (const observation of observations) {
      if (
        observation.domain !== query.identity.domain
        || observationSemanticSeriesKey(observation) !== query.identity.seriesKey
        || (query.sourceId !== undefined && observation.sourceId !== query.sourceId)
      ) {
        throw new Error("Supabase Observation history returned a record outside the requested semantic identity.");
      }
    }
    observations.sort(compareObservationHistory);
    if (query.order === "DESC") observations.reverse();
    return observations.slice(0, query.limit);
  }
}
