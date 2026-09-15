import type { Confidence, EvidenceRef, Intelligence } from "./types";
import { assertIntelligenceContract } from "./contracts";

export function createIntelligence(input: {
  id: string;
  what: string;
  why: string;
  confirms?: EvidenceRef[];
  contradicts?: EvidenceRef[];
  invalidates?: string[];
  monitor?: string[];
  confidence: Confidence;
  evidenceIds: string[];
}): Intelligence {
  const intelligence = {
    id: input.id,
    what: input.what,
    why: input.why,
    confirms: input.confirms ?? [],
    contradicts: input.contradicts ?? [],
    invalidates: input.invalidates ?? [],
    monitor: input.monitor ?? [],
    confidence: input.confidence,
    evidenceIds: input.evidenceIds,
    createdAt: new Date().toISOString(),
  } satisfies Intelligence;

  return assertIntelligenceContract(intelligence);
}
