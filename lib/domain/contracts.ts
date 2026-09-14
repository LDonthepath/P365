import type { Context, Intelligence, Risk, State } from "./types";

/**
 * Domain-level guardrails for the Context → State → Risk → Intelligence contract.
 * These checks validate traceability and semantic completeness only; they do not
 * interpret market conditions or create signals.
 */
export function assertContextHasEvidence(context: Context): Context {
  if (context.observationIds.length === 0 && context.eventIds.length === 0) {
    throw new Error(`Context ${context.id} must reference at least one observation or event`);
  }
  return context;
}

export function assertStateHasEvidence(state: State): State {
  if (state.evidenceIds.length === 0) {
    throw new Error(`State ${state.id} must reference at least one evidence item`);
  }
  return state;
}

export function assertRiskHasEvidence(risk: Risk): Risk {
  if (risk.evidenceIds.length === 0) {
    throw new Error(`Risk ${risk.id} must reference at least one evidence item`);
  }
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

  const evidenceRefIds = [...intelligence.confirms, ...intelligence.contradicts]
    .map((ref) => ref.id.trim())
    .filter(Boolean);

  if (intelligence.confirms.some((ref) => ref.id.trim().length === 0)) {
    throw new Error(`Intelligence ${intelligence.id} contains an invalid CONFIRMS evidence reference`);
  }

  if (intelligence.contradicts.some((ref) => ref.id.trim().length === 0)) {
    throw new Error(`Intelligence ${intelligence.id} contains an invalid CONTRADICTS evidence reference`);
  }

  const duplicateEvidenceRefs = evidenceRefIds.filter(
    (id, index) => evidenceRefIds.indexOf(id) !== index,
  );

  if (duplicateEvidenceRefs.length > 0) {
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
