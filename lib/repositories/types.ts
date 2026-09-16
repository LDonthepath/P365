import type { Context, Event, Evidence, Observation } from "../domain/types";

export interface ObservationRepository {
  save(observation: Observation): Promise<void>;
  saveMany(observations: Observation[]): Promise<void>;
  findById(id: string): Promise<Observation | null>;
}

export interface EventRepository {
  save(event: Event): Promise<void>;
  saveMany(events: Event[]): Promise<void>;
  findById(id: string): Promise<Event | null>;
}

export interface EvidenceRepository {
  save(evidence: Evidence): Promise<void>;
  saveMany(evidence: Evidence[]): Promise<void>;
  findById(id: string): Promise<Evidence | null>;
}

export interface ContextRepository {
  save(context: Context): Promise<void>;
  saveMany(contexts: Context[]): Promise<void>;
  findById(id: string): Promise<Context | null>;
}

/**
 * Generic contract reserved for the immutable MarketSnapshot introduced in P0-05.
 * Keeping the repository generic prevents this stage from defining snapshot semantics.
 */
export interface SnapshotRepository<TSnapshot extends { id: string }> {
  save(snapshot: TSnapshot): Promise<void>;
  findById(id: string): Promise<TSnapshot | null>;
}
