import "server-only";
import type { MacroEvidenceHistoryPort, CapturedMacroObservation, StoredMacroObservation } from "../application/macro-evidence-bundle";

/**
 * Narrow #370 read-only adapter for the existing append-only Market Memory.
 * The generic HistoricalObservationRepository does not expose physical
 * captured_at at an arbitrary T, so this adapter preserves it without
 * changing global repository behavior or adding a SQL RPC/schema.
 */
export class SupabaseMacroEvidenceHistory implements MacroEvidenceHistoryPort {
  constructor(private readonly options: {
    config: () => { url: string; key: string };
    fetch?: typeof fetch;
  }) {}

  async findAsOf(input: {
    seriesId: string;
    asOf: string;
    limit: number;
  }): Promise<CapturedMacroObservation[]> {
    const cutoff = Date.parse(input.asOf);
    if (!Number.isFinite(cutoff) || new Date(cutoff).toISOString() !== input.asOf
      || !/^[A-Z0-9]+$/.test(input.seriesId)
      || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 500) {
      throw new Error("Invalid bounded macro evidence history query");
    }
    const { url, key } = this.options.config();
    if (!/^https:\/\//.test(url) || !key) throw new Error("Macro evidence needs server-only Supabase configuration");

    const params = new URLSearchParams();
    params.set("select", "captured_at,payload");
    params.set("record_type", "eq.OBSERVATION");
    params.set("payload->>domain", "eq.MACRO");
    params.set("payload->metadata->>seriesId", "eq." + input.seriesId);
    params.set("payload->>sourceId", "eq.fred");
    params.set("captured_at", "lte." + input.asOf);
    params.set("effective_at", "lte." + input.asOf);
    params.set("order", "effective_at.desc,captured_at.desc,id.desc");
    params.set("limit", String(input.limit));

    const response = await (this.options.fetch ?? fetch)(
      url.replace(/\/$/, "") + "/rest/v1/market_memory?" + params.toString(),
      {
        method: "GET",
        headers: { apikey: key, Authorization: "Bearer " + key },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Macro evidence durable read failed (" + response.status + ")");
    const raw: unknown = await response.json();
    if (!Array.isArray(raw) || raw.length > input.limit) {
      throw new Error("Macro evidence durable read returned an invalid page");
    }
    return raw.map((item: unknown): CapturedMacroObservation => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("Macro evidence durable row is malformed");
      }
      const row = item as Record<string, unknown>;
      const payload = row.payload;
      if (typeof row.captured_at !== "string"
        || !Number.isFinite(Date.parse(row.captured_at))
        || Date.parse(row.captured_at) > cutoff
        || !payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Macro evidence durable row lacks a qualified capture");
      }
      const o = payload as Partial<StoredMacroObservation>;
      if (typeof o.id !== "string" || typeof o.observedAt !== "string"
        || typeof o.evidenceId !== "string" || typeof o.value !== "string"
        || typeof o.sourceId !== "string" || typeof o.domain !== "string"
        || typeof o.quality !== "string") {
        throw new Error("Macro evidence row is not a canonical Observation");
      }
      // Runtime qualification of unit, series, time, source and revision occurs
      // inside the bundle selector. No substitute for missing retrievedAt.
      return {
        capturedAt: row.captured_at,
        observation: payload as StoredMacroObservation,
      };
    });
  }
}
