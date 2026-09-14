import "server-only";
import type { NewsItem, ProviderResult } from "./types";
import { XMLParser } from "fast-xml-parser";

const COINDESK_RSS_URL = "https://www.coindesk.com/arc/outboundfeeds/rss/";

type RssItem = { title?: string; link?: string; pubDate?: string; description?: string };

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

export async function fetchCoinDeskNews(limit = 6): Promise<ProviderResult<NewsItem>> {
  try {
    const res = await fetch(COINDESK_RSS_URL, { next: { revalidate: 900 } });
    if (!res.ok) return { status: "ERROR", data: [], message: `CoinDesk HTTP ${res.status}` };

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const rawItems = parsed?.rss?.channel?.item;
    const items: RssItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const data = items.slice(0, limit).map((item, index): NewsItem => ({
      id: item.link ?? `coindesk-${index}`,
      category: "CRYPTO",
      source: "CoinDesk",
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      title: stripHtml(item.title ?? ""),
      summary: stripHtml(item.description ?? ""),
      url: item.link ?? COINDESK_RSS_URL,
    }));
    return { status: data.length > 0 ? "SUCCESS" : "EMPTY", data };
  } catch (error) {
    return { status: "ERROR", data: [], message: error instanceof Error ? error.message : "CoinDesk request failed" };
  }
}
