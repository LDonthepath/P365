/**
 * GET-local transport for the existing single-series Observation history adapter.
 * Coalesces HTTP requests only; the original per-series paging, PIT, revision,
 * source, malformed-row and tie-boundary logic remains the sole authority.
 */
const SINGLE_RPC = "/rest/v1/rpc/p365_observation_history_candidates_v1";
const BATCH_RPC = "/rest/v1/rpc/p365_observation_history_candidates_batch_v1";
const MAX_GROUP = 16;
type Pending = {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
  resolve: (response: Response) => void;
  reject: (reason: unknown) => void;
};
export type DashboardBatchTransportStats = {
  networkRequests: number;
  sourceRequests: number;
  failedBatches: number;
};

export function createDashboardBatchFetch(baseFetch: typeof fetch = fetch): {
  fetch: typeof fetch;
  stats: () => DashboardBatchTransportStats;
} {
  const queue: Pending[] = [];
  let scheduled = false;
  let networkRequests = 0;
  let sourceRequests = 0;
  let failedBatches = 0;

  async function flush(group: Pending[]): Promise<void> {
    try {
      const first = group[0];
      if (!first) return;
      const firstHeaders = new Headers(first.init.headers);
      // A response must never be routed across origins or authorization contexts.
      if (group.some((part) => part.url !== first.url
        || new Headers(part.init.headers).get("authorization") !== firstHeaders.get("authorization")
        || new Headers(part.init.headers).get("apikey") !== firstHeaders.get("apikey"))) {
        throw new Error("Observation batch transport request context mismatch");
      }
      networkRequests++;
      const response = await baseFetch(first.url.replace(SINGLE_RPC, BATCH_RPC), {
        method: "POST",
        headers: first.init.headers,
        body: JSON.stringify({ p_requests: group.map((part) => part.body) }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error("Observation batch transport HTTP failure (" + response.status + ")");
      }
      const raw: unknown = await response.json();
      if (!Array.isArray(raw)) throw new Error("Observation batch transport returned a non-array");
      const pages: Array<Array<{ id: string; effective_at: string; payload: unknown }>> =
        Array.from({ length: group.length }, () => []);
      for (const item of raw) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new Error("Observation batch transport returned a malformed row");
        }
        const row = item as Record<string, unknown>;
        const index = row.request_index;
        if (!Number.isInteger(index) || typeof index !== "number" || index < 1 || index > group.length
          || typeof row.id !== "string" || typeof row.effective_at !== "string") {
          throw new Error("Observation batch transport returned an invalid request index or row");
        }
        // Preserve arbitrary canonical payloads; the existing adapter owns validation.
        pages[index - 1].push({ id: row.id, effective_at: row.effective_at, payload: row.payload });
      }
      group.forEach((part, index) => {
        if (part.init.signal?.aborted) {
          part.reject(new Error("Observation batch transport request timed out"));
        } else {
          part.resolve(new Response(JSON.stringify(pages[index]), {
            status: 200, headers: { "Content-Type": "application/json" },
          }));
        }
      });
    } catch {
      failedBatches++;
      // Never present partial data or fall back to stale/unqualified reads.
      group.forEach((part) => part.reject(new Error("Observation batch transport failed closed")));
    }
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const group = queue.splice(0, MAX_GROUP);
      if (group.length) void flush(group);
      if (queue.length) schedule();
    });
  }

  const batchedFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.pathname.endsWith(SINGLE_RPC) || init?.method !== "POST" || typeof init.body !== "string") {
      return baseFetch(input, init);
    }
    // An invalid request is rejected rather than silently sent to the legacy endpoint.
    const body: unknown = JSON.parse(init.body);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Observation batch transport expects one object per request");
    }
    sourceRequests++;
    return new Promise<Response>((resolve, reject) => {
      queue.push({ url: url.toString(), init, body: body as Record<string, unknown>, resolve, reject });
      schedule();
    });
  };
  return {
    fetch: batchedFetch,
    stats: () => ({ networkRequests, sourceRequests, failedBatches }),
  };
}
