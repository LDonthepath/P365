import type { Context, Event, Evidence, Observation } from "../domain/types";
import type { ContextRepository, EventRepository, EvidenceRepository, ObservationRepository } from "./types";

export class InMemoryObservationRepository implements ObservationRepository {
  private readonly items = new Map<string, Observation>();
  async save(item: Observation): Promise<void> { this.items.set(item.id, item); }
  async saveMany(items: Observation[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); }
  async findById(id: string): Promise<Observation | null> { return this.items.get(id) ?? null; }
}

export class InMemoryEventRepository implements EventRepository {
  private readonly items = new Map<string, Event>();
  async save(item: Event): Promise<void> { this.items.set(item.id, item); }
  async saveMany(items: Event[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); }
  async findById(id: string): Promise<Event | null> { return this.items.get(id) ?? null; }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly items = new Map<string, Evidence>();
  async save(item: Evidence): Promise<void> { this.items.set(item.id, item); }
  async saveMany(items: Evidence[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); }
  async findById(id: string): Promise<Evidence | null> { return this.items.get(id) ?? null; }
}

export class InMemoryContextRepository implements ContextRepository {
  private readonly items = new Map<string, Context>();
  async save(item: Context): Promise<void> { this.items.set(item.id, item); }
  async saveMany(items: Context[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); }
  async findById(id: string): Promise<Context | null> { return this.items.get(id) ?? null; }
}
