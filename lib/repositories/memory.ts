import type { Context, Event, Evidence, Observation } from "../domain/types";
import type { ContextRepository, EventRepository, EvidenceRepository, HistoricalObservationRepository, ObservationHistoryQuery, ObservationRepository } from "./types";
import { compareObservationHistory, observationHistoryTimestamp, observationSemanticSeriesKey, validateObservationHistoryQuery } from "./observation-history";

export class InMemoryObservationRepository implements ObservationRepository, HistoricalObservationRepository {
  private readonly items = new Map<string, Observation>();

  async save(item: Observation): Promise<void> { if (!this.items.has(item.id)) this.items.set(item.id, item); }
  async saveMany(items: Observation[]): Promise<void> { items.forEach((item) => { if (!this.items.has(item.id)) this.items.set(item.id, item); }); }
  async findById(id: string): Promise<Observation | null> { return this.items.get(id) ?? null; }

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    const { from, through, retrievedThrough } = validateObservationHistoryQuery(query);
    const matches = [...this.items.values()].filter((observation) => {
      if (
        observation.domain !== query.identity.domain
        || observationSemanticSeriesKey(observation) !== query.identity.seriesKey
        || (query.sourceId !== undefined && observation.sourceId !== query.sourceId)
      ) return false;

      const observedAt = observationHistoryTimestamp(observation.observedAt, "Observation.observedAt");
      const retrievedAt = observationHistoryTimestamp(observation.retrievedAt, "Observation.retrievedAt");
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
