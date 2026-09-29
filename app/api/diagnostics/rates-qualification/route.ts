import { reconstructHistoricalZtEvent } from "../../../../lib/application/rates-historical-reconstruction";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ status: "DISABLED" }, { status: 404 });
  }

  const result = await reconstructHistoricalZtEvent("2026-09-24T12:30:00.000Z");
  return Response.json(result, {
    status: result.status === "ERROR" ? 502 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
