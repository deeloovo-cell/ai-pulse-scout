export type EntryPageKind = 'feed_page' | 'article_page' | 'listing_page' | 'unknown_page';

export function classifyEntryPage(_url: string, html: string): EntryPageKind {
  if (/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["'][^"']*(rss|atom)\+xml/i.test(html)) {
    return 'feed_page';
  }

  if (/(article:published_time|application\/ld\+json|<article[\s>])/i.test(html)) {
    return 'article_page';
  }

  const articleLikeLinks = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((href) => /\/blog\/|\/post|\/posts\/|\/article|\/articles\/|\/news\/|\/research\//i.test(href));

  if (articleLikeLinks.length >= 2) {
    return 'listing_page';
  }

  return 'unknown_page';
}
