import type { Evidence, Risk, RiskLevel } from "./types";

export function buildRisk(input: {
  id: string;
  domain: string;
  level: RiskLevel;
  statement: string;
  reason: string;
  evidence: Evidence[];
  evaluatedAt?: string;
}): Risk {
  return {
    id: input.id,
    domain: input.domain,
    level: input.level,
    statement: input.statement,
    reason: input.reason,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    evidenceIds: input.evidence.map((item) => item.id),
  };
}

export function riskHasEvidence(risk: Risk): boolean {
  return risk.evidenceIds.length > 0;
}
