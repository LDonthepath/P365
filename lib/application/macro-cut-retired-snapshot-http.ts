import { isCronRequestAuthorized } from "./cron-auth";

/**
 * The historical asset-pricing Snapshot pipeline depended on deleted
 * CoinGecko/Yahoo series. Preserve the protected route/auth boundary but do
 * not permit a write or an asset-based historical reconstruction.
 * A new macro-only Snapshot contract requires a separate owner review.
 */
export function createRetiredAssetSnapshotHandler(
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (!isCronRequestAuthorized(
      request.headers.get("authorization"),
      readSecret(),
    )) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json(
      {
        status: "RETIRED",
        reason: "ASSET_DEPENDENT_SNAPSHOT_CAPTURE_RETIRED",
        writesPerformed: false,
      },
      { status: 410, headers: { "cache-control": "no-store" } },
    );
  };
}
