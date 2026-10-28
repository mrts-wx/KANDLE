const googleNewsFeed = (key, label, query, edition = 'br') => {
  const params = edition === 'us'
    ? { hl: 'en-US', gl: 'US', ceid: 'US:en' }
    : { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' };
  return { key, label, url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${params.hl}&gl=${params.gl}&ceid=${encodeURIComponent(params.ceid)}` };
};

const FEEDS = [
  googleNewsFeed('brasil', 'BRASIL · POLÍTICA', '(política OR governo OR Congresso OR Planalto OR STF OR eleições OR presidente OR ministério) when:2d'),
  googleNewsFeed('brasil', 'BRASIL · ECONOMIA', '(economia brasileira OR inflação OR Selic OR Banco Central OR dólar OR Ibovespa OR mercado financeiro) when:2d'),
  googleNewsFeed('crypto', 'CRIPTO', '(Bitcoin OR Ethereum OR criptomoedas OR Binance OR blockchain) when:2d'),
  googleNewsFeed('global', 'GLOBAL · POLÍTICA', '(política internacional OR eleições EUA OR Donald Trump OR Casa Branca OR guerra OR tarifas OR sanções OR geopolítica) when:2d'),
  googleNewsFeed('global', 'GLOBAL · ECONOMIA', '(Federal Reserve OR Wall Street OR inflation OR interest rates OR stock market OR GDP OR trade tariffs) when:2d', 'us'),
  { key: 'crypto', label: 'COINDESK', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { key: 'crypto', label: 'COINTELEGRAPH', url: 'https://cointelegraph.com/rss' }
];

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=45, s-maxage=45, stale-while-revalidate=180',
  'x-content-type-options': 'nosniff',
  'access-control-allow-origin': '*'
};

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (url.searchParams.has('refresh') && origin && origin !== url.origin) {
    return json({ error: 'Origin not allowed', items: [], sources: [] }, 403, { 'cache-control': 'no-store' });
  }

  // Each feed falls back to RSS2JSON if the upstream denies or times out on direct RSS fetches.
  // No third-party key is required; the browser only calls this same-origin endpoint.
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const merged = new Map();
  for (const result of results) {
    for (const item of result.items) {
      const key = normalizeTitle(item.title);
      if (!key) continue;
      const existing = merged.get(key);
      if (!existing || item.published > existing.published) merged.set(key, item);
    }
  }
  const items = [...merged.values()].sort((a, b) => b.published - a.published).slice(0, 75);
  const sources = results.map(({ source }) => source);
  const okCount = sources.filter(source => source.ok).length;
  return json({
    items,
    sources,
    updatedAt: Date.now(),
    partial: okCount < sources.length,
    error: items.length ? null : 'Nenhuma fonte RSS respondeu com manchetes válidas.'
  }, 200);
}

async function fetchFeed(feed) {
  let directError = 'Falha no feed RSS';
  try {
    const response = await fetch(feed.url, {
      headers: {
        'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'user-agent': 'Mozilla/5.0 (compatible; KANDLE-NewsRadar/1.3; +https://kandle.mrts-wx.workers.dev)'
      },
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 45, cacheEverything: true }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('Resposta não é RSS/Atom');
    const items = parseFeed(xml, feed);
    if (!items.length) throw new Error('Feed sem itens válidos');
    return { source: { key: feed.key, label: feed.label, ok: true, via: 'rss', count: items.length }, items };
  } catch (error) {
    directError = String(error?.message || error).slice(0, 100);
  }

  try {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=20`;
    const response = await fetch(proxyUrl, {
      headers: { 'accept': 'application/json', 'user-agent': 'KANDLE-NewsRadar/1.3' },
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 45, cacheEverything: true }
    });
    if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error(data.message || 'Proxy RSS sem itens');
    const items = data.items.map(item => {
      const title = cleanText(item.title || '');
      const link = safeHttpUrl(item.link || '');
      const dateValue = Date.parse(item.pubDate || '');
      if (!title || !link) return null;
      return {
        id: hash(`${link}|${title}`), title: title.slice(0, 280),
        description: cleanText(item.description || item.content || '').slice(0, 1000),
        url: link, source: cleanText(item.author || data.feed?.title || feed.label).slice(0, 80) || feed.label,
        published: Number.isFinite(dateValue) ? dateValue : Date.now(), category: feed.key,
        categoryLabel: feed.label === 'COINDESK' || feed.label === 'COINTELEGRAPH' ? 'CRIPTO' : feed.label
      };
    }).filter(Boolean);
    if (!items.length) throw new Error('Proxy não retornou manchetes válidas');
    return { source: { key: feed.key, label: feed.label, ok: true, via: 'rss2json', count: items.length }, items };
  } catch (proxyError) {
    return {
      source: { key: feed.key, label: feed.label, ok: false, via: 'rss+fallback', count: 0, error: `${directError}; fallback: ${String(proxyError?.message || proxyError).slice(0, 70)}` },
      items: []
    };
  }
}

function parseFeed(xml, feed) {
  const records = [];
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  for (const match of blocks) {
    const block = match[2];
    const title = cleanText(readTag(block, 'title'));
    const description = cleanText(readTag(block, 'description') || readTag(block, 'summary') || readTag(block, 'content:encoded') || readTag(block, 'content'));
    const link = safeHttpUrl(readTag(block, 'link') || block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || '');
    const publishedText = readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated') || readTag(block, 'dc:date');
    const candidate = Date.parse(cleanText(publishedText));
    const published = Number.isFinite(candidate) ? candidate : Date.now();
    const source = cleanText(readTag(block, 'source') || readTag(block, 'author') || feed.label).slice(0, 80) || feed.label;
    if (!title || !link) continue;
    records.push({ id: hash(`${link}|${title}`), title: title.slice(0, 280), description: description.slice(0, 1000), url: link, source, published, category: feed.key, categoryLabel: feed.label === 'COINDESK' || feed.label === 'COINTELEGRAPH' ? 'CRIPTO' : feed.label });
  }
  return records;
}

function readTag(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, 'i'));
  if (match) return match[1];
  if (name === 'link') return xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || '';
  return '';
}
function cleanText(value = '') {
  return decodeXml(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function decodeXml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([\da-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
}
function safeHttpUrl(value = '') { try { const url = new URL(decodeXml(value).trim()); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function normalizeTitle(value = '') { return String(value).normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function hash(value = '') { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
function json(body, status = 200, extraHeaders = {}) { return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extraHeaders } }); }
