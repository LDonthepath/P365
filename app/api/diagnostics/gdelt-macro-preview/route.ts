import { createGdeltMacroQualificationHandler } from "../../../../lib/application/gdelt-macro-qualification-http";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const GET = createGdeltMacroQualificationHandler();
