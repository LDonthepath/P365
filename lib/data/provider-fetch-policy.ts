import { cacheTagForRevalidate } from "./cache-policy";

export type ProviderAcquisitionMode = "CACHED" | "FRESH";

type ProviderFetchPolicy =
  | { cache: "no-store" }
  | { next: { revalidate: number; tags: [ReturnType<typeof cacheTagForRevalidate>] } };

/** Dashboard reads retain cadence caching; independent ingestion explicitly bypasses it. */
export function providerFetchPolicy(
  mode: ProviderAcquisitionMode,
  revalidateSeconds: number,
): ProviderFetchPolicy {
  if (mode === "FRESH") return { cache: "no-store" };
  return {
    next: {
      revalidate: revalidateSeconds,
      tags: [cacheTagForRevalidate(revalidateSeconds)],
    },
  };
}
