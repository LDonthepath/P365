/**
 * G1-01: one immutable market-read clock per dashboard request.
 *
 * knowledgeAsOf freezes when facts could have been known to the request;
 * persistedBefore is the same requested historical read cutoff. Repository
 * queries presently enforce canonical retrievedAt, NOT SQL captured_at; this
 * value is not proof of physical database visibility at a past instant.
 * evaluatedAt records when composition finished and must never increase the
 * historical eligibility window.
 */
export type MarketReadContext = Readonly<{
  knowledgeAsOf: string;
  persistedBefore: string;
  evaluatedAt: string;
}>;

export function beginMarketReadContext(now: Date): MarketReadContext {
  if (!Number.isFinite(now.getTime())) throw new Error("MarketReadContext needs a valid start instant");
  const cutoff = now.toISOString();
  return Object.freeze({
    knowledgeAsOf: cutoff,
    persistedBefore: cutoff,
    evaluatedAt: cutoff,
  });
}

export function completeMarketReadContext(
  context: MarketReadContext,
  evaluatedAt: Date,
): MarketReadContext {
  if (!Number.isFinite(evaluatedAt.getTime()) ||
      evaluatedAt.getTime() < Date.parse(context.knowledgeAsOf)) {
    throw new Error("MarketReadContext evaluation cannot precede knowledge cutoff");
  }
  return Object.freeze({ ...context, evaluatedAt: evaluatedAt.toISOString() });
}
