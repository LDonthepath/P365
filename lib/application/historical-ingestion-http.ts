import {
  runHistoricalIngestion,
  type HistoricalIngestionReport,
  type HistoricalIngestionOptions,
} from "./historical-ingestion";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import { isCronRequestAuthorized } from "./cron-auth";
import { planFredReleaseAwareObservations, type FredSchedulerPlan } from "./fred-release-aware-selection";
import { planFredProviderUpdatedObservations, type FredProviderUpdatePlan } from "./fred-provider-update-selection";

type HistoricalIngestionRunner = (options: HistoricalIngestionOptions) => Promise<HistoricalIngestionReport>;

export function isHistoricalIngestionAuthorized(authorization: string | null, secret: string | undefined): boolean {
  return isCronRequestAuthorized(authorization, secret);
}

export function createHistoricalIngestionHandler(
  runner: HistoricalIngestionRunner = runHistoricalIngestion,
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
  planFred: () => Promise<FredSchedulerPlan> = planFredReleaseAwareObservations,
  planFredProviderUpdates: () => Promise<FredProviderUpdatePlan> = planFredProviderUpdatedObservations,
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (!isHistoricalIngestionAuthorized(request.headers.get("authorization"), readSecret())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = parseHistoricalIngestionRequest(new URL(request.url).searchParams);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    // No provider request is made until the user passes existing CRON_SECRET auth.
    // fredReleaseAware is exclusive with fredSeries and coingecko-context.
    const plan = parsed.fredReleaseAware ? await planFred()
      : parsed.fredProviderUpdates ? await planFredProviderUpdates() : null;
    const options = plan ? { ...parsed.options, fred: { seriesIds: plan.seriesIds } } : parsed.options;
    const report = await runner(options);
    const fredSchedule = plan
      ? "calendarDateNY" in plan
        ? {
          mode: plan.mode,
          calendarDateNY: plan.calendarDateNY,
          requestedSeriesCount: plan.requestedSeriesCount,
          releaseWindowSeriesCount: plan.releaseWindowSeriesCount,
        }
        : {
          mode: plan.mode,
          scanAsOfUTC: plan.scanAsOfUTC,
          scanWindowStartUTC: plan.scanWindowStartUTC,
          requestedSeriesCount: plan.requestedSeriesCount,
          matchedRegisteredUpdates: plan.matchedRegisteredUpdates,
          ...(plan.failureReason ? { failureReason: plan.failureReason } : {}),
          ...(plan.upstreamHttpStatus !== undefined
            ? { upstreamHttpStatus: plan.upstreamHttpStatus } : {}),
          ...(plan.timeoutRetries === 1 ? { timeoutRetries: 1 } : {}),
        }
      : undefined;
    return Response.json(plan ? {
      ...report,
      fredSchedule,
    } : report, { status: report.status === "FAILED" ? 500 : 200 });
  };
}
