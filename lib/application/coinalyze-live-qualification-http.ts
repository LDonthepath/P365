import { isCronRequestAuthorized } from "./cron-auth";
import {
  runCoinalyzeLiveQualification,
  type CoinalyzeLiveQualificationReport,
} from "./coinalyze-live-qualification";

type Runner = () => Promise<CoinalyzeLiveQualificationReport>;

export function createCoinalyzeLiveQualificationHandler(
  runner: Runner = runCoinalyzeLiveQualification,
  readSecret: () => string | undefined = () => process.env.CRON_SECRET,
): (request: Request) => Promise<Response> {
  return async function handle(request: Request): Promise<Response> {
    if (!isCronRequestAuthorized(request.headers.get("authorization"), readSecret())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await runner();
    const status = report.status === "BLOCKED_NO_API_KEY"
      ? 503
      : report.status === "FAILED"
        ? 502
        : 200;
    return Response.json(report, { status });
  };
}
