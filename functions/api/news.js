const FEEDS = [
  {
    key: 'brasil', label: 'BRASIL',
    url: 'https://news.google.com/rss/search?q=%28mercado+financeiro+OR+Ibovespa+OR+Selic+OR+Banco+Central%29+when%3A2d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'
  },
  {
    key: 'crypto', label: 'CRIPTO',
    url: 'https://news.google.com/rss/search?q=%28Bitcoin+OR+Ethereum+OR+criptomoedas+OR+Binance%29+when%3A2d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'
  },
  {
    key: 'global', label: 'GLOBAL',
    url: 'https://news.google.com/rss/search?q=%28Wall+Street+OR+Federal+Reserve+OR+NASDAQ+OR+inflation+OR+tariffs%29+when%3A2d&hl=en-US&gl=US&ceid=US%3Aen'
  },
  { key: 'crypto', label: 'COINDESK', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { key: 'crypto', label: 'COINTELEGRAPH', url: 'https://cointelegraph.com/rss' }
];

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=180',
  'x-content-type-options': 'nosniff'
};

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  if (url.searchParams.get('refresh') === '1' && request.headers.get('origin') && request.headers.get('origin') !== url.origin) {
    return json({ error: 'Origin not allowed' }, 403, { 'cache-control': 'no-store' });
  }

  const results = await Promise.all(FEEDS.map(async (feed) => {
    try {
      const response = await fetch(feed.url, {
        headers: {
          'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          'user-agent': 'KANDLE-Market-Intelligence/1.2 (RSS feed reader)'
        },
        signal: AbortSignal.timeout(9000),
        cf: { cacheTtl: 60, cacheEverything: true }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (!xml || !/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('Resposta não é RSS/Atom');
      const items = parseFeed(xml, feed);
      if (!items.length) throw new Error('Feed sem itens');
      return { source: { key: feed.key, label: feed.label, ok: true, count: items.length }, items };
    } catch (error) {
      return { source: { key: feed.key, label: feed.label, ok: false, count: 0, error: String(error?.message || error).slice(0, 90) }, items: [] };
    }
  }));

  const merged = new Map();
  for (const result of results) {
    for (const item of result.items) {
      const key = normalizeTitle(item.title);
      if (!key) continue;
      const existing = merged.get(key);
      if (!existing || item.published > existing.published) merged.set(key, item);
    }
  }
  const items = [...merged.values()]
    .sort((a, b) => b.published - a.published)
    .slice(0, 75);
  const sources = results.map(result => result.source);
  const okCount = sources.filter(source => source.ok).length;
  const status = items.length ? 200 : 502;
  return json({ items, sources, updatedAt: Date.now(), partial: okCount < sources.length }, status);
}

function parseFeed(xml, feed) {
  const records = [];
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  for (const match of blocks) {
    const block = match[2];
    const title = cleanText(readTag(block, 'title'));
    const description = cleanText(readTag(block, 'description') || readTag(block, 'summary') || readTag(block, 'content:encoded') || readTag(block, 'content'));
    let link = readTag(block, 'link');
    if (!link) {
      const linkMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
      link = linkMatch?.[1] || '';
    }
    link = decodeXml(link);
    let publishedText = readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated') || readTag(block, 'dc:date');
    const publishedCandidate = Date.parse(decodeXml(publishedText));
    const published = Number.isFinite(publishedCandidate) ? publishedCandidate : Date.now();
    const source = cleanText(readTag(block, 'source') || readTag(block, 'author') || feed.label).slice(0, 80) || feed.label;
    let parsedUrl = '';
    try { const candidate = new URL(link); if (candidate.protocol === 'https:' || candidate.protocol === 'http:') parsedUrl = candidate.href; } catch {}
    if (!title || !parsedUrl) continue;
    records.push({ id: hash(`${parsedUrl}|${title}`), title: title.slice(0, 280), description: description.slice(0, 1000), url: parsedUrl, source, published, category: feed.key, categoryLabel: feed.label === 'COINDESK' || feed.label === 'COINTELEGRAPH' ? 'CRIPTO' : feed.label });
  }
  return records;
}

function readTag(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, 'i'));
  if (match) return match[1];
  // Atom links commonly use href attributes instead of text content.
  if (name === 'link') return xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || '';
  return '';
}

function cleanText(value = '') {
  const decoded = decodeXml(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function decodeXml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
}
function normalizeTitle(value = '') { return String(value).normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function hash(value = '') { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
function json(body, status = 200, extraHeaders = {}) { return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extraHeaders } }); }
