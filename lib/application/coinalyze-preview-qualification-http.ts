import {
  runCoinalyzeLiveQualification,
  type CoinalyzeLiveQualificationReport,
} from "./coinalyze-live-qualification";

type Runner = () => Promise<CoinalyzeLiveQualificationReport>;

export function createCoinalyzePreviewQualificationHandler(
  runner: Runner = runCoinalyzeLiveQualification,
  readVercelEnv: () => string | undefined = () => process.env.VERCEL_ENV,
): () => Promise<Response> {
  return async function handle(): Promise<Response> {
    if (readVercelEnv() !== "preview") {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    const report = await runner();
    const status = report.status === "BLOCKED_NO_API_KEY"
      ? 503
      : report.status === "FAILED"
        ? 502
        : 200;

    return Response.json(report, {
      status,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  };
}
