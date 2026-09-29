import { createRatesHistoricalReconstructionHandler } from "../../../../lib/application/rates-historical-reconstruction-http";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = createRatesHistoricalReconstructionHandler();
