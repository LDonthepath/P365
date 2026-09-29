import { isCronRequestAuthorized } from "./cron-auth";
import { reconstructHistoricalZtEvent } from "./rates-historical-reconstruction";

export function createRatesHistoricalReconstructionHandler(
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (!isCronRequestAuthorized(request.headers.get("authorization"), readSecret())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const eventAt = new URL(request.url).searchParams.get("eventAt");
    if (!eventAt) return Response.json({ error: "eventAt is required" }, { status: 400 });
    const result = await reconstructHistoricalZtEvent(eventAt);
    return Response.json(result, { status: result.status === "ERROR" ? 502 : 200 });
  };
}
