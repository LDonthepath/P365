import { createFredMetadataDiagnosticHandler } from "../../../../lib/application/fred-metadata-diagnostic";

// Owner-operated diagnostic only. This route is not scheduled and does not persist data.
export const dynamic = "force-dynamic";
export const GET = createFredMetadataDiagnosticHandler();
