import { qualifyGdeltGalSharedFeed } from "../data/gdelt-gal";

export function createGdeltMacroQualificationHandler(
  runner: typeof qualifyGdeltGalSharedFeed = qualifyGdeltGalSharedFeed,
  readEnvironment: () => string | undefined = () => process.env.VERCEL_ENV,
) {
  return async () => {
    const headers = { "cache-control": "no-store", "x-robots-tag": "noindex" };
    if (readEnvironment() !== "preview") {
      return Response.json({ error: "Not Found" }, { status: 404, headers });
    }
    try {
      const result = await runner();
      return Response.json({ writesPerformed: false, result }, {
        status: result.status === "SUCCESS" ? 200 : 502, headers,
      });
    } catch {
      return Response.json({ writesPerformed: false, error: "Qualification failed" }, { status: 502, headers });
    }
  };
}
