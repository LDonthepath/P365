import type { Context, Event, Evidence, Observation } from "../domain/types";
import {
  InMemoryContextRepository,
  InMemoryEventRepository,
  InMemoryEvidenceRepository,
  InMemoryObservationRepository,
} from "./memory";
import type { ContextRepository, EventRepository, EvidenceRepository, ObservationRepository } from "./types";

export type CanonicalRepositories = {
  observations: ObservationRepository;
  events: EventRepository;
  evidence: EvidenceRepository;
  contexts: ContextRepository;
};

/**
 * Process-local repository set. This is intentionally an adapter, not durable storage.
 * A database-backed implementation can replace it without changing callers.
 */
export const canonicalRepositories: CanonicalRepositories = {
  observations: new InMemoryObservationRepository(),
  events: new InMemoryEventRepository(),
  evidence: new InMemoryEvidenceRepository(),
  contexts: new InMemoryContextRepository(),
};

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
