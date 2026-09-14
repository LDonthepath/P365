import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "./types";

const COINDESK_RSS_URL = "https://www.coindesk.com/arc/outboundfeeds/rss/";

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

export async function fetchCoinDeskNews(limit = 6): Promise<NewsItem[]> {
  try {
    const res = await fetch(COINDESK_RSS_URL, { next: { revalidate: 900 } });
    if (!res.ok) return [];

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const rawItems = parsed?.rss?.channel?.item;
    const items: RssItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return items.slice(0, limit).map((item, index): NewsItem => {
      const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
      return {
        id: item.link ?? `coindesk-${index}`,
        category: "CRYPTO",
        source: "CoinDesk",
        publishedAt,
        title: stripHtml(item.title ?? ""),
        summary: stripHtml(item.description ?? ""),
        url: item.link ?? COINDESK_RSS_URL,
      };
    });
  } catch {
    return [];
  }
}
