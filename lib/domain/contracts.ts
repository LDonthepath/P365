import type { Context, Intelligence, Risk, State } from "./types";

/**
 * Domain-level guardrails for the Context → State → Risk → Intelligence contract.
 * These checks validate traceability and semantic completeness only; they do not
 * interpret market conditions or create signals.
 */
function assertNonEmptyUniqueIds(ids: string[], label: string, ownerId: string): void {
  if (ids.some((id) => id.trim().length === 0)) {
    throw new Error(`${label} ${ownerId} contains an empty evidence/fact reference`);
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} ${ownerId} contains duplicate evidence/fact references`);
  }
}

export function assertContextHasEvidence(context: Context): Context {
  if (context.observationIds.length === 0 && context.eventIds.length === 0) {
    throw new Error(`Context ${context.id} must reference at least one observation or event`);
  }

  assertNonEmptyUniqueIds(context.observationIds, "Context", context.id);
  assertNonEmptyUniqueIds(context.eventIds, "Context", context.id);
  return context;
}

export function assertStateHasEvidence(state: State): State {
  if (state.evidenceIds.length === 0) {
    throw new Error(`State ${state.id} must reference at least one evidence item`);
  }

  assertNonEmptyUniqueIds(state.evidenceIds, "State", state.id);
  return state;
}

export function assertRiskHasEvidence(risk: Risk): Risk {
  if (risk.evidenceIds.length === 0) {
    throw new Error(`Risk ${risk.id} must reference at least one evidence item`);
  }

  assertNonEmptyUniqueIds(risk.evidenceIds, "Risk", risk.id);
  return risk;
}

export function assertIntelligenceContract(intelligence: Intelligence): Intelligence {
  if (intelligence.what.trim().length === 0) {
    throw new Error(`Intelligence ${intelligence.id} must define WHAT`);
  }

  if (intelligence.why.trim().length === 0) {
    throw new Error(`Intelligence ${intelligence.id} must define WHY`);
  }

  if (intelligence.evidenceIds.length === 0) {
    throw new Error(`Intelligence ${intelligence.id} must reference at least one evidence item`);
  }

  assertNonEmptyUniqueIds(intelligence.evidenceIds, "Intelligence", intelligence.id);

  const evidenceRefIds = [...intelligence.confirms, ...intelligence.contradicts]
    .map((ref) => ref.id.trim());

  if (intelligence.confirms.some((ref) => ref.id.trim().length === 0)) {
    throw new Error(`Intelligence ${intelligence.id} contains an invalid CONFIRMS evidence reference`);
  }

  if (intelligence.contradicts.some((ref) => ref.id.trim().length === 0)) {
    throw new Error(`Intelligence ${intelligence.id} contains an invalid CONTRADICTS evidence reference`);
  }

  if (evidenceRefIds.some((id) => !intelligence.evidenceIds.includes(id))) {
    throw new Error(`Intelligence ${intelligence.id} contains an evidence reference not listed in evidenceIds`);
  }

  if (new Set(evidenceRefIds).size !== evidenceRefIds.length) {
    throw new Error(`Intelligence ${intelligence.id} contains duplicate evidence references`);
  }

  if (intelligence.invalidates.some((item) => item.trim().length === 0)) {
    throw new Error(`Intelligence ${intelligence.id} contains an empty INVALIDATES criterion`);
  }

  if (intelligence.monitor.some((item) => item.trim().length === 0)) {
    throw new Error(`Intelligence ${intelligence.id} contains an empty MONITOR criterion`);
  }

  return intelligence;
}
