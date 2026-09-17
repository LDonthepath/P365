import type { Context, Event, Evidence, Observation } from "../domain/types";
import { supabaseCanonicalRepositories } from "../data/market-memory-store";
import { InMemoryContextRepository, InMemoryEventRepository, InMemoryEvidenceRepository, InMemoryObservationRepository } from "./memory";
import type { ContextRepository, EventRepository, EvidenceRepository, ObservationRepository } from "./types";

export type CanonicalRepositories = {
  observations: ObservationRepository;
  events: EventRepository;
  evidence: EvidenceRepository;
  contexts: ContextRepository;
};

/** Durable canonical persistence. Set P365_MEMORY_PERSISTENCE=memory only for local development. */
export const canonicalRepositories: CanonicalRepositories =
  process.env.P365_MEMORY_PERSISTENCE === "memory"
    ? {
        observations: new InMemoryObservationRepository(),
        events: new InMemoryEventRepository(),
        evidence: new InMemoryEvidenceRepository(),
        contexts: new InMemoryContextRepository(),
      }
    : supabaseCanonicalRepositories;

export async function persistCanonicalDashboardData(
  repositories: CanonicalRepositories,
  data: { observations: Observation[]; events: Event[]; evidence: Evidence[]; contexts: Context[] },
): Promise<void> {
  await Promise.all([
    repositories.observations.saveMany(data.observations),
    repositories.events.saveMany(data.events),
    repositories.evidence.saveMany(data.evidence),
    repositories.contexts.saveMany(data.contexts),
  ]);
}
