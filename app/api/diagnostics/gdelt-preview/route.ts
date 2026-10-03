export const runtime = "nodejs";
export const maxDuration = 25;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const response = await fetch("https://data.gdeltproject.org/gdeltv3/gal/feed.rss", {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const text = await response.text();
    return Response.json(
      {
        writesPerformed: false,
        status: response.status,
        contentType: response.headers.get("content-type"),
        contentLengthHeader: response.headers.get("content-length"),
        bodyBytes: new TextEncoder().encode(text).byteLength,
        sample: text.slice(0, 1200),
      },
      {
        status: response.ok ? 200 : 502,
        headers: {
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        writesPerformed: false,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 502, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
    );
  }
}
