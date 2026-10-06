import { catalystTitleExclusion } from "../application/catalyst-title-screening";

/** Display projection only; feed coverage and durable candidate evidence stay authoritative. */
export function screenMoveCatalystTitles<T extends { title: string }>(
  candidates: readonly T[],
  asset: "BTC" | "GOLD",
): { items: T[]; excludedTitleCount: number } {
  const items = candidates.filter((candidate) => catalystTitleExclusion(candidate.title, asset) === null);
  return { items, excludedTitleCount: candidates.length - items.length };
}
