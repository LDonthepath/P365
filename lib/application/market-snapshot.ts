import {
  buildMarketSnapshot,
  type MarketSnapshot,
  type MarketSnapshotRequest,
} from "../domain/market-snapshot";
import type { MarketSnapshotRepository } from "../repositories/types";

/**
 * Captures one immutable Market Snapshot and persists it append-only.
 *
 * Trigger/cadence ownership is deliberately outside SNP-001. Callers must
 * supply the explicit capturedAt, scope requirements, and already-qualified
 * point-in-time inputs.
 */
export async function captureMarketSnapshot(
  request: MarketSnapshotRequest,
  repository: MarketSnapshotRepository,
): Promise<MarketSnapshot> {
  const snapshot = buildMarketSnapshot(request);
  await repository.save(snapshot);
  return snapshot;
}
