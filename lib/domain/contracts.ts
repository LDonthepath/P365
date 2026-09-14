import type { Context, Risk, State } from "./types";

/**
 * Domain-level guardrails for the Context → State → Risk contract.
 * These checks intentionally validate evidence linkage only; they do not
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
