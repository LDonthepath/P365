import type { Context, Event, Evidence, Observation } from "../domain/types";
import type { ContextRepository, EventRepository, EvidenceRepository, HistoricalObservationRepository, ObservationHistoryQuery, ObservationRepository } from "./types";

const MAX_OBSERVATION_HISTORY_LIMIT = 500;

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} timestamp: ${value}`);
  return parsed;
}

function validateHistoryQuery(query: ObservationHistoryQuery): { from?: number; through?: number; retrievedThrough?: number } {
  if (!query.identity.seriesKey.trim()) {
    throw new Error("Observation history identity requires a non-empty seriesKey.");
  }
  if (query.sourceId !== undefined && !query.sourceId.trim()) {
    throw new Error("Observation history sourceId filter must be non-empty when supplied.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_OBSERVATION_HISTORY_LIMIT) {
    throw new Error(`Observation history limit must be an integer between 1 and ${MAX_OBSERVATION_HISTORY_LIMIT}.`);
  }
  if (query.order !== "ASC" && query.order !== "DESC") {
    throw new Error("Observation history order must be ASC or DESC.");
  }

  const from = query.observedAtOnOrAfter === undefined
    ? undefined
    : timestamp(query.observedAtOnOrAfter, "observedAtOnOrAfter");
  const through = query.observedAtOnOrBefore === undefined
    ? undefined
    : timestamp(query.observedAtOnOrBefore, "observedAtOnOrBefore");
  const retrievedThrough = query.retrievedAtOnOrBefore === undefined
    ? undefined
    : timestamp(query.retrievedAtOnOrBefore, "retrievedAtOnOrBefore");
  if (from !== undefined && through !== undefined && from > through) {
    throw new Error("Observation history lower time bound must not be after its upper bound.");
  }
  return { from, through, retrievedThrough };
}

function observationSemanticSeriesKey(observation: Observation): string | null {
  const seriesId = observation.metadata?.seriesId;
  if (typeof seriesId === "string" && seriesId.trim()) return seriesId;
  const metricId = observation.metadata?.metricId;
  if (typeof metricId === "string" && metricId.trim()) return metricId;
  return null;
}

function compareObservationHistory(a: Observation, b: Observation): number {
  const observed = timestamp(a.observedAt, "Observation.observedAt") - timestamp(b.observedAt, "Observation.observedAt");
  if (observed !== 0) return observed;
  const retrieved = timestamp(a.retrievedAt, "Observation.retrievedAt") - timestamp(b.retrievedAt, "Observation.retrievedAt");
  if (retrieved !== 0) return retrieved;
  return a.id.localeCompare(b.id);
}

export class InMemoryObservationRepository implements ObservationRepository, HistoricalObservationRepository {
  private readonly items = new Map<string, Observation>();

  async save(item: Observation): Promise<void> { this.items.set(item.id, item); }
  async saveMany(items: Observation[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); }
  async findById(id: string): Promise<Observation | null> { return this.items.get(id) ?? null; }

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    const { from, through, retrievedThrough } = validateHistoryQuery(query);
    const matches = [...this.items.values()].filter((observation) => {
      if (
        observation.domain !== query.identity.domain
        || observationSemanticSeriesKey(observation) !== query.identity.seriesKey
        || (query.sourceId !== undefined && observation.sourceId !== query.sourceId)
      ) return false;

      const observedAt = timestamp(observation.observedAt, "Observation.observedAt");
      const retrievedAt = timestamp(observation.retrievedAt, "Observation.retrievedAt");
      return (from === undefined || observedAt >= from)
        && (through === undefined || observedAt <= through)
        && (retrievedThrough === undefined || retrievedAt <= retrievedThrough);
    });
    matches.sort(compareObservationHistory);
    if (query.order === "DESC") matches.reverse();
    return matches.slice(0, query.limit);
  }
}
export class InMemoryEventRepository implements EventRepository { private readonly items = new Map<string, Event>(); async save(item: Event): Promise<void> { this.items.set(item.id, item); } async saveMany(items: Event[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); } async findById(id: string): Promise<Event | null> { return this.items.get(id) ?? null; } }
export class InMemoryEvidenceRepository implements EvidenceRepository { private readonly items = new Map<string, Evidence>(); async save(item: Evidence): Promise<void> { this.items.set(item.id, item); } async saveMany(items: Evidence[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); } async findById(id: string): Promise<Evidence | null> { return this.items.get(id) ?? null; } }
export class InMemoryContextRepository implements ContextRepository { private readonly items = new Map<string, Context>(); async save(item: Context): Promise<void> { this.items.set(item.id, item); } async saveMany(items: Context[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); } async findById(id: string): Promise<Context | null> { return this.items.get(id) ?? null; } }
