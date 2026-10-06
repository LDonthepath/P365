import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Context, Event, Evidence, Observation } from "../domain/types";
import type { ContextRepository, EventHistoryQuery, EventRepository, EvidenceHistoryQuery, EvidenceRepository, HistoricalEvidenceRepository, HistoricalEventRepository, HistoricalMarketSnapshotRepository, HistoricalObservationRepository, MarketSnapshotHistoryQuery, MarketSnapshotRepository, ObservationHistoryQuery, ObservationRepository } from "./types";
import { compareObservationHistory, observationHistoryTimestamp, observationSemanticSeriesKey, validateObservationHistoryQuery } from "./observation-history";
import { compareMarketSnapshotHistory, marketSnapshotHistoryTimestamp, validateMarketSnapshotHistoryQuery } from "./snapshot-history";
import { compareEventHistory, validateEventHistoryQuery } from "./event-history";
import { compareEvidenceHistory, evidenceHistoryEffectiveAt, validateEvidenceHistoryQuery } from "./evidence-history";

export class InMemoryObservationRepository implements ObservationRepository, HistoricalObservationRepository {
  private readonly items = new Map<string, Observation>();

  async save(item: Observation): Promise<void> { if (!this.items.has(item.id)) this.items.set(item.id, item); }
  async saveMany(items: Observation[]): Promise<void> { items.forEach((item) => { if (!this.items.has(item.id)) this.items.set(item.id, item); }); }
  async findById(id: string): Promise<Observation | null> { return this.items.get(id) ?? null; }
  async findManyByIds(ids: string[]): Promise<Observation[]> {
    return [...new Set(ids)].flatMap((id) => {
      const item = this.items.get(id);
      return item ? [item] : [];
    });
  }

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
export class InMemoryMarketSnapshotRepository
implements MarketSnapshotRepository, HistoricalMarketSnapshotRepository {
  private readonly items = new Map<string, MarketSnapshot>();

  async save(item: MarketSnapshot): Promise<void> {
    if (!this.items.has(item.id)) this.items.set(item.id, item);
  }

  async saveMany(items: MarketSnapshot[]): Promise<void> {
    items.forEach((item) => {
      if (!this.items.has(item.id)) this.items.set(item.id, item);
    });
  }

  async findById(id: string): Promise<MarketSnapshot | null> {
    return this.items.get(id) ?? null;
  }

  async findHistory(query: MarketSnapshotHistoryQuery): Promise<MarketSnapshot[]> {
    const bounds = validateMarketSnapshotHistoryQuery(query);
    const matches = [...this.items.values()].filter((snapshot) => {
      if (snapshot.scope !== query.scope) return false;
      const capturedAt = marketSnapshotHistoryTimestamp(
        snapshot.capturedAt,
        "MarketSnapshot.capturedAt",
      );
      return (bounds.from === undefined || capturedAt >= bounds.from)
        && (bounds.through === undefined || capturedAt <= bounds.through);
    });
    matches.sort(compareMarketSnapshotHistory);
    if (query.order === "DESC") matches.reverse();
    return matches.slice(0, query.limit);
  }
}

export class InMemoryHistoricalEventRepository
implements HistoricalEventRepository {
  constructor(private readonly source: InMemoryEventRepository) {}

  async findHistory(query: EventHistoryQuery): Promise<Event[]> {
    const bounds = validateEventHistoryQuery(query);
    const candidates = this.source.all().filter((event) => {
      if (
        query.eventIdentityKey !== undefined
        && event.identity?.key !== query.eventIdentityKey
      ) return false;
      if (
        query.importance !== undefined
        && event.importance !== query.importance
      ) return false;

      const scheduledValue = event.identity?.scheduledAt ?? event.scheduledAt;
      if (!scheduledValue) return false;
      const scheduled = Date.parse(scheduledValue);
      const retrieved = Date.parse(event.retrievedAt);
      if (!Number.isFinite(scheduled) || !Number.isFinite(retrieved)) return false;

      return (bounds.scheduledFrom === undefined || scheduled >= bounds.scheduledFrom)
        && (bounds.scheduledThrough === undefined || scheduled <= bounds.scheduledThrough)
        && (bounds.retrievedThrough === undefined || retrieved <= bounds.retrievedThrough);
    });

    candidates.sort(compareEventHistory);
    if (query.order === "DESC") candidates.reverse();
    return candidates.slice(0, query.limit);
  }
}

export class InMemoryEventRepository implements EventRepository {
  private readonly items = new Map<string, Event>();

  async save(item: Event): Promise<void> {
    this.items.set(item.id, item);
  }

  async saveMany(items: Event[]): Promise<void> {
    items.forEach((item) => this.items.set(item.id, item));
  }

  all(): Event[] {
    return [...this.items.values()];
  }

  async findById(id: string): Promise<Event | null> {
    return this.items.get(id) ?? null;
  }
}
export class InMemoryEvidenceRepository
implements EvidenceRepository, HistoricalEvidenceRepository {
  private readonly items = new Map<string, Evidence>();

  async save(item: Evidence): Promise<void> {
    if (!this.items.has(item.id)) this.items.set(item.id, item);
  }

  async saveMany(items: Evidence[]): Promise<void> {
    items.forEach((item) => {
      if (!this.items.has(item.id)) this.items.set(item.id, item);
    });
  }

  async findById(id: string): Promise<Evidence | null> {
    return this.items.get(id) ?? null;
  }

  async findHistory(query: EvidenceHistoryQuery): Promise<Evidence[]> {
    const bounds = validateEvidenceHistoryQuery(query);
    const matches = [...this.items.values()].filter((evidence) => {
      if (query.evidenceId !== undefined && evidence.id !== query.evidenceId) return false;
      if (query.sourceId !== undefined && evidence.sourceId !== query.sourceId) return false;
      if (query.kind !== undefined && evidence.kind !== query.kind) return false;
      for (const [key, value] of Object.entries(query.metadataEquals ?? {})) {
        if (evidence.metadata?.[key] !== value) return false;
      }

      const effectiveAt = evidenceHistoryEffectiveAt(evidence);
      const retrievedAt = Date.parse(evidence.retrievedAt);
      return (bounds.effectiveFrom === undefined || effectiveAt >= bounds.effectiveFrom)
        && (bounds.effectiveThrough === undefined || effectiveAt <= bounds.effectiveThrough)
        && (bounds.retrievedThrough === undefined || retrievedAt <= bounds.retrievedThrough);
    });

    matches.sort(compareEvidenceHistory);
    if (query.order === "DESC") matches.reverse();
    return matches.slice(0, query.limit);
  }
}
export class InMemoryContextRepository implements ContextRepository { private readonly items = new Map<string, Context>(); async save(item: Context): Promise<void> { this.items.set(item.id, item); } async saveMany(items: Context[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); } async findById(id: string): Promise<Context | null> { return this.items.get(id) ?? null; } }
