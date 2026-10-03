import { createCoinalyzePreviewQualificationHandler } from "../../../../lib/application/coinalyze-preview-qualification-http";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export const GET = createCoinalyzePreviewQualificationHandler();
