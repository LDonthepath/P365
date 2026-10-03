import { createCoinalyzeLiveQualificationHandler } from "../../../../lib/application/coinalyze-live-qualification-http";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export const GET = createCoinalyzeLiveQualificationHandler();
