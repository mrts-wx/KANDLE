(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ASSETS = [
    { symbol: 'BTCUSDT', ticker: 'BTC', name: 'Bitcoin', glyph: '₿', className: 'btc-symbol' },
    { symbol: 'ETHUSDT', ticker: 'ETH', name: 'Ethereum', glyph: '◆', className: 'eth-symbol' },
    { symbol: 'SOLUSDT', ticker: 'SOL', name: 'Solana', glyph: 'S', className: 'sol' },
    { symbol: 'BNBUSDT', ticker: 'BNB', name: 'BNB', glyph: '◈', className: 'bnb' },
    { symbol: 'XRPUSDT', ticker: 'XRP', name: 'XRP', glyph: 'X', className: 'xrp' },
    { symbol: 'DOGEUSDT', ticker: 'DOGE', name: 'Dogecoin', glyph: 'Ð', className: 'doge' },
    { symbol: 'ADAUSDT', ticker: 'ADA', name: 'Cardano', glyph: 'A', className: 'ada' },
    { symbol: 'AVAXUSDT', ticker: 'AVAX', name: 'Avalanche', glyph: '▲', className: 'avax' }
  ];
  const API = 'https://data-api.binance.vision/api/v3';
  const googleNewsFeed = (key, label, query, edition = 'br') => {
    const params = edition === 'us'
      ? { hl: 'en-US', gl: 'US', ceid: 'US:en' }
      : { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' };
    return { key, label, url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${params.hl}&gl=${params.gl}&ceid=${encodeURIComponent(params.ceid)}` };
  };
  const NEWS_FEEDS = [
    googleNewsFeed('brasil', 'BRASIL · POLÍTICA', '(política OR governo OR Congresso OR Planalto OR STF OR eleições OR presidente OR ministério) when:2d'),
    googleNewsFeed('brasil', 'BRASIL · ECONOMIA', '(economia brasileira OR inflação OR Selic OR Banco Central OR dólar OR Ibovespa OR mercado financeiro) when:2d'),
    googleNewsFeed('crypto', 'CRIPTO', '(Bitcoin OR Ethereum OR criptomoedas OR Binance OR blockchain) when:2d'),
    googleNewsFeed('global', 'GLOBAL · POLÍTICA', '(política internacional OR eleições EUA OR Donald Trump OR Casa Branca OR guerra OR tarifas OR sanções OR geopolítica) when:2d'),
    googleNewsFeed('global', 'GLOBAL · ECONOMIA', '(Federal Reserve OR Wall Street OR inflation OR interest rates OR stock market OR GDP OR trade tariffs) when:2d', 'us'),
    { key: 'crypto', label: 'COINDESK', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { key: 'crypto', label: 'COINTELEGRAPH', url: 'https://cointelegraph.com/rss' }
  ];
  const HIGH_PRIORITY = /emerg.ncia|breaking|urgente|alerta de mercado|colapso|crash|despenca|desab[aã]|derrete|queda de \d{1,2}%|alta de \d{1,2}%|sobe \d{1,2}%|salta|dispara|surge|plunge|recorde hist.rico|máxima hist.rica|mínima hist.rica|decisão de juros|corta juros|eleva juros|taxa de juros|federal reserve.{0,45}(cut|raise|rate|juros)|banco central.{0,45}(juros|taxa|corte)|infla..o.{0,35}(acima|abaixo|acelera|desacelera|surpreende)|cpi.{0,35}(above|below|surprise)|sec.{0,35}(aprova|rejeita|sues|lawsuit)|aprova..o.{0,35}etf|etf.{0,35}(aprova|approved|inflow|record)|liquida..o|hack|ataque cibern.tico|fal.ncia|default|tarif.{0,35}(anuncia|impo|sobe)|san..es|recess.o|invas.o|ataque militar|estado de emerg.ncia|renuncia|impeachment|resultado eleitoral|elei..es presidenciais|queda de governo|acordo de paz/i;
  const state = {
    prices: {}, selectedSymbol: 'BTCUSDT', interval: '1h', chart: null, candleSeries: null, volumeSeries: null,
    candles: [], socket: null, tickerSocket: null, tickerRetry: null, klineRetry: null,
    chartRequestId: 0, chartRetry: null, watchlist: readJSON('kandle-watchlist', ['BTCUSDT', 'ETHUSDT']),
    assetFilter: 'all', assetSearch: '', news: [], newsFilter: 'all', newsInitialized: false, newsSources: [],
    newsLoading: false, breakingEnabled: readJSON('kandle-breaking-enabled', true),
    breakingSoundEnabled: readJSON('kandle-breaking-sound-enabled', true), audioContext: null,
    seenNews: readJSON('kandle-seen-news', []), breakingQueue: [], breakingActive: false, breakingTimers: [], chartResizeObserver: null,
    refreshTimer: null, firstPriceLoad: false, chartLibraryFailed: typeof window.LightweightCharts === 'undefined',
    pendingTickerSymbols: new Set(), tickerFlushTimer: null, lastRadarSignature: '', lastTableUpdateAt: 0,
    theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  };

  function readJSON(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing can disable storage */ } }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function stripHTML(value) { const box = document.createElement('textarea'); box.innerHTML = String(value || '').replace(/<[^>]*>/g, ' '); return box.value.replace(/\s+/g, ' ').trim(); }
  function assetFor(symbol) { return ASSETS.find(asset => asset.symbol === symbol) || ASSETS[0]; }
  function numeric(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
  const priceFormatters = new Map();
  const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  function formatPrice(value) {
    const number = numeric(value);
    if (!number) return '—';
    const decimals = number < 0.01 ? 6 : number < 1 ? 5 : number < 100 ? 3 : 2;
    const minimum = number < 1 ? Math.min(4, decimals) : 2;
    const key = `${minimum}:${decimals}`;
    let formatter = priceFormatters.get(key);
    if (!formatter) { formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: minimum, maximumFractionDigits: decimals }); priceFormatters.set(key, formatter); }
    return formatter.format(number);
  }
  function formatCompact(value) {
    const number = numeric(value);
    if (!number) return '—';
    return compactFormatter.format(number);
  }
  function formatVolume(value) { const number = numeric(value); return number ? '$' + formatCompact(number) : '—'; }
  function formatPct(value) { const number = numeric(value); return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`; }
  function pctClass(value) { return numeric(value) > 0 ? 'up' : numeric(value) < 0 ? 'down' : 'neutral'; }
  function changeHTML(value, attribute = '') { const up = numeric(value) > 0; const down = numeric(value) < 0; const icon = up ? '<i data-lucide="trending-up"></i>' : down ? '<i data-lucide="trending-down"></i>' : ''; return `<span ${attribute} class="metric-change ${pctClass(value)}">${icon}${escapeHTML(formatPct(value))}</span>`; }
  function toast(title, description = '', warn = false) {
    const stack = $('#toast-stack'); const item = document.createElement('div'); item.className = `toast${warn ? ' toast-warn' : ''}`;
    item.innerHTML = `<strong>${escapeHTML(title)}</strong>${description ? `<span>${escapeHTML(description)}</span>` : ''}`; stack.appendChild(item);
    window.setTimeout(() => { item.style.opacity = '0'; item.style.transform = 'translateY(6px)'; window.setTimeout(() => item.remove(), 250); }, 4200);
  }
  // Original KANDLE broadcast sting synthesized locally with Web Audio (no external audio file).
  // Browsers require a user gesture before playing sound; the first click/tap unlocks the context.
  function unlockBreakingAudio() {
    if (!state.breakingSoundEnabled) return Promise.resolve(false);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return Promise.resolve(false);
    try {
      if (!state.audioContext || state.audioContext.state === 'closed') state.audioContext = new AudioContextClass();
      const context = state.audioContext;
      const ready = context.state === 'running' ? Promise.resolve() : context.resume();
      return ready.then(() => context.state === 'running').catch(() => false);
    } catch (error) {
      console.warn('KANDLE audio is unavailable:', error);
      return Promise.resolve(false);
    }
  }

  function synthTone(context, output, frequency, startAt, duration, level, type = 'triangle', endFrequency = frequency) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), startAt);
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startAt + duration);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), startAt + Math.min(0.018, duration * 0.22));
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.025);
    oscillator.addEventListener('ended', () => { oscillator.disconnect(); envelope.disconnect(); }, { once: true });
  }

  function playBreakingSting() {
    if (!state.breakingSoundEnabled || !state.audioContext || state.audioContext.state !== 'running') return false;
    const context = state.audioContext;
    const output = context.createGain();
    output.gain.setValueAtTime(0.58, context.currentTime);
    output.connect(context.destination);
    const start = context.currentTime + 0.025;

    // Low, short impact followed by a rising three-part broadcast motif.
    synthTone(context, output, 118, start, 0.29, 0.20, 'sine', 43);
    synthTone(context, output, 196, start + 0.015, 0.23, 0.065, 'triangle', 104);
    const notes = [
      { at: 0.075, hz: 440.00, len: 0.23, gain: 0.080 },
      { at: 0.285, hz: 554.37, len: 0.25, gain: 0.083 },
      { at: 0.505, hz: 659.25, len: 0.30, gain: 0.087 },
      { at: 0.755, hz: 783.99, len: 0.39, gain: 0.075 }
    ];
    for (const note of notes) {
      synthTone(context, output, note.hz, start + note.at, note.len, note.gain, 'triangle');
      synthTone(context, output, note.hz * 1.5, start + note.at, note.len * 0.74, note.gain * 0.24, 'sine');
    }
    synthTone(context, output, 1174.66, start + 0.80, 0.19, 0.023, 'sine', 784);
    window.setTimeout(() => { try { output.disconnect(); } catch { /* already disconnected */ } }, 1550);
    return true;
  }

  function updateSoundToggle() {
    const button = $('#sound-toggle');
    if (!button) return;
    const enabled = state.breakingSoundEnabled;
    button.classList.toggle('sound-active', enabled);
    button.classList.toggle('sound-muted', !enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Desativar som de breaking news' : 'Ativar som de breaking news');
    button.title = enabled ? 'Som de breaking news ativado' : 'Som de breaking news desativado';
    button.innerHTML = `<i data-lucide="${enabled ? 'volume-2' : 'volume-x'}"></i>`;
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  function setConnection(label, status, online = false) {
    $('#connection-label').textContent = label; $('#connection-pill').textContent = status;
    $('#connection-pill').style.color = online ? 'var(--green)' : 'var(--amber)';
    $('#connection-pill').style.borderColor = online ? 'rgba(24,246,163,.2)' : 'rgba(255,202,112,.2)';
  }
  function initDateClock() {
    const now = new Date(); const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(now); const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(now).replace('.', '').toUpperCase(); const year = now.getFullYear();
    $('#today-date').textContent = `${day} ${month} ${year}`;
    const clockFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tick = () => {
      const time = clockFormatter.format(new Date());
      setTextIfChanged($('#clock'), time); setTextIfChanged($('#ticker-time'), time);
    };
    tick(); window.setInterval(tick, 1000);
  }
  function avatarHTML(asset, extra = '') { return `<span class="coin-avatar ${escapeHTML(asset.className)} ${extra}" aria-hidden="true">${escapeHTML(asset.glyph)}</span>`; }
  function chartPalette() {
    const light = document.documentElement.dataset.theme === 'light';
    return light
      ? { up: '#00864f', down: '#cf204d', upVolume: 'rgba(0,134,79,.23)', downVolume: 'rgba(207,32,77,.22)', text: '#566171', grid: 'rgba(31,43,59,.10)', border: 'rgba(31,43,59,.16)', cross: 'rgba(0,109,128,.32)' }
      : { up: '#00e575', down: '#ff426f', upVolume: 'rgba(0,229,117,.25)', downVolume: 'rgba(255,66,111,.25)', text: '#aeb8c8', grid: 'rgba(174,188,210,.09)', border: 'rgba(174,188,210,.16)', cross: 'rgba(103,232,242,.32)' };
  }
  function applyChartTheme() {
    const p = chartPalette();
    if (state.chart) state.chart.applyOptions({
      layout: { textColor: p.text },
      grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
      rightPriceScale: { borderColor: p.border },
      timeScale: { borderColor: p.border },
      crosshair: { vertLine: { color: p.cross }, horzLine: { color: p.cross } }
    });
    state.candleSeries?.applyOptions({ upColor: p.up, downColor: p.down, borderUpColor: p.up, borderDownColor: p.down, wickUpColor: p.up, wickDownColor: p.down });
    if (state.volumeSeries && state.candles.length) state.volumeSeries.setData(state.candles.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? p.upVolume : p.downVolume })));
    if (state.chartLibraryFailed) drawFallbackChart();
  }
  function setTheme(theme, { persist = true } = {}) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme === 'light' ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'light' ? '#F3F4F6' : '#171A1F');
    const button = $('#theme-toggle');
    if (button) {
      const light = state.theme === 'light';
      button.innerHTML = `<i data-lucide="${light ? 'moon' : 'sun'}"></i>`;
      button.title = light ? 'Mudar para tema cinza-chumbo' : 'Mudar para tema branco';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(light));
      if (window.lucide) window.lucide.createIcons({ root: button, attrs: { 'stroke-width': 1.8 } });
    }
    if (persist) writeJSON('kandle-theme', state.theme);
    applyChartTheme();
    // TradingView iframe widgets don't reliably repaint when the site theme changes.
    // Tear down the old iframe/script and rebuild with explicit foreground + background colors.
    $$('.macro-widget-card .tradingview-widget-container').forEach(container => {
      container.dataset.tvInitialized = 'false';
      container.dataset.tvGeneration = String((Number(container.dataset.tvGeneration) || 0) + 1);
      const host = container.querySelector('.tradingview-widget-container__widget');
      container.dataset.tvTheme = '';
      if (host) {
        host.replaceChildren();
        const loading = document.createElement('div');
        loading.className = 'macro-widget-loading';
        loading.textContent = 'Atualizando tema do gráfico…';
        host.appendChild(loading);
        delete host.dataset.fallbackShown;
      }
      container.querySelectorAll('iframe, script').forEach(element => element.remove());
    });
    if (document.body.dataset.currentPage === 'markets') requestAnimationFrame(() => initializeMacroWidgets());
  }
  function initChart() {
    const container = $('#candlestick-chart');
    if (!window.LightweightCharts) { state.chartLibraryFailed = true; $('#fallback-chart').hidden = false; return; }
    container.innerHTML = ''; $('#fallback-chart').hidden = true;
    try {
      const palette = chartPalette();
      state.chart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 650, height: container.clientHeight || 330,
        layout: { background: { type: 'solid', color: 'rgba(0,0,0,0)' }, textColor: palette.text, fontFamily: 'DM Mono, monospace', fontSize: 10 },
        grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
        rightPriceScale: { borderColor: palette.border, scaleMargins: { top: .09, bottom: .22 } },
        timeScale: { borderColor: palette.border, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 3 },
        crosshair: { vertLine: { color: palette.cross, width: 1, style: LightweightCharts.LineStyle.Dashed }, horzLine: { color: palette.cross, width: 1, style: LightweightCharts.LineStyle.Dashed } },
        localization: { priceFormatter: price => formatPrice(price) },
        handleScroll: { mouseWheel: true, pressedMouseMove: true }, handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
      });
      state.candleSeries = state.chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: palette.up, downColor: palette.down, borderUpColor: palette.up, borderDownColor: palette.down, wickUpColor: palette.up, wickDownColor: palette.down, priceLineColor: palette.cross, priceLineStyle: LightweightCharts.LineStyle.Dotted });
      state.volumeSeries = state.chart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' });
      state.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: .82, bottom: 0 }, visible: false });
      if (!state.chartResizeObserver) {
        state.chartResizeObserver = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect?.width && rect?.height && state.chart) state.chart.applyOptions({ width: rect.width, height: rect.height }); if (state.chartLibraryFailed && rect?.width) drawFallbackChart(); });
        state.chartResizeObserver.observe(container);
        window.addEventListener('resize', () => { if (state.chart && container.clientWidth && container.clientHeight) state.chart.applyOptions({ width: container.clientWidth, height: container.clientHeight }); if (state.chartLibraryFailed) drawFallbackChart(); });
      }
    } catch (error) { console.warn('Chart initialization failed:', error); state.chartLibraryFailed = true; $('#fallback-chart').hidden = false; }
  }
  async function fetchJSON(url, timeout = 11000) {
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeout);
    try { const response = await fetch(url, { signal: controller.signal, cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
    finally { window.clearTimeout(timer); }
  }
  async function loadTickers() {
    const url = `${API}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(ASSETS.map(a => a.symbol)))}`;
    try {
      const data = await fetchJSON(url);
      if (!Array.isArray(data)) throw new Error('Resposta inesperada da API');
      data.forEach(record => applyTicker(record));
      state.firstPriceLoad = true; renderAllPrices(); setConnection('Dados conectados à Binance', 'REST OK', true); $('#table-updated').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
    } catch (error) {
      console.warn('Batch ticker failed; trying individual symbols:', error);
      try {
        const results = await Promise.allSettled(ASSETS.map(asset => fetchJSON(`${API}/ticker/24hr?symbol=${asset.symbol}`, 9000)));
        let successes = 0; results.forEach(result => { if (result.status === 'fulfilled') { applyTicker(result.value); successes++; } });
        if (!successes) throw new Error('Binance indisponível');
        state.firstPriceLoad = true; renderAllPrices(); setConnection('Dados conectados à Binance', 'REST OK', true); $('#table-updated').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
      } catch (fallbackError) {
        setConnection('Tentando reconectar', 'RETRY', false);
        toast('Não foi possível buscar as cotações', 'Confira sua conexão. O terminal tentará novamente.', true);
      }
    }
  }
  function applyTicker(record) {
    if (!record || !record.symbol) return;
    const asset = assetFor(record.symbol); if (!asset) return;
    state.prices[record.symbol] = {
      ...(state.prices[record.symbol] || {}), symbol: record.symbol,
      price: numeric(record.lastPrice), change: numeric(record.priceChangePercent), high: numeric(record.highPrice), low: numeric(record.lowPrice),
      volume: numeric(record.quoteVolume), baseVolume: numeric(record.volume), trades: numeric(record.count), open: numeric(record.openPrice),
      weightedAvg: numeric(record.weightedAvgPrice), updatedAt: Date.now()
    };
  }
  function connectTickerSocket() {
    if (state.tickerSocket) { try { state.tickerSocket.close(); } catch {} }
    if (state.tickerRetry) clearTimeout(state.tickerRetry);
    const streams = ASSETS.map(a => `${a.symbol.toLowerCase()}@ticker`).join('/');
    let socket;
    try { socket = new WebSocket(`wss://data-stream.binance.vision/stream?streams=${streams}`); }
    catch { scheduleTickerReconnect(); return; }
    state.tickerSocket = socket;
    socket.onopen = () => { setConnection('Conexão de mercado ativa', 'LIVE WS', true); };
    socket.onmessage = event => {
      try { const message = JSON.parse(event.data); const data = message.data || message; if (data.s) { applyTicker({ symbol: data.s, lastPrice: data.c, priceChangePercent: data.P, highPrice: data.h, lowPrice: data.l, quoteVolume: data.q, volume: data.v, count: data.n, openPrice: data.o, weightedAvgPrice: data.w }); queueTickerDOM(data.s); } }
      catch (error) { console.warn('Bad ticker websocket payload', error); }
    };
    socket.onerror = () => setConnection('Reconectando ao mercado', 'RETRY', false);
    socket.onclose = () => { if (state.tickerSocket === socket) { setConnection('Reconectando ao mercado', 'RETRY', false); scheduleTickerReconnect(); } };
  }
  function scheduleTickerReconnect() { if (state.tickerRetry) clearTimeout(state.tickerRetry); state.tickerRetry = setTimeout(connectTickerSocket, 4500); }
  function queueTickerDOM(symbol) {
    state.pendingTickerSymbols.add(symbol);
    if (state.tickerFlushTimer) return;
    // Coalesce bursts into at most ~10 UI refreshes per second; the live socket remains real-time.
    state.tickerFlushTimer = window.setTimeout(() => {
      state.tickerFlushTimer = null;
      const changed = [...state.pendingTickerSymbols];
      state.pendingTickerSymbols.clear();
      requestAnimationFrame(() => {
        changed.forEach(updateTickerDOM);
        if (changed.length) updateRadarValues();
      });
    }, 100);
  }
  function setTextIfChanged(element, value) {
    if (element && element.textContent !== String(value)) element.textContent = String(value);
  }
  function updateTickerDOM(symbol) {
    const asset = assetFor(symbol); const data = state.prices[symbol]; if (!data) return;
    $$(`[data-price-for="${symbol}"]`).forEach(el => {
      const old = Number(el.dataset.lastValue || 0);
      const nextText = formatPrice(data.price);
      if (el.textContent !== nextText) {
        setTextIfChanged(el, nextText);
        if (old && old !== data.price) {
          const flashClass = data.price >= old ? 'tick-up' : 'tick-down';
          if (!el.classList.contains(flashClass)) {
            el.classList.remove('tick-up', 'tick-down');
            el.classList.add(flashClass);
            el.addEventListener('animationend', () => el.classList.remove('tick-up', 'tick-down'), { once: true });
          }
        }
      }
      el.dataset.lastValue = String(data.price);
    });
    $$(`[data-change-for="${symbol}"]`).forEach(el => {
      const styleClass = el.classList.contains('ticker-change') ? 'ticker-change' : 'metric-change';
      const className = `${styleClass} ${pctClass(data.change)}`;
      const text = `${data.change > 0 ? '↗ ' : data.change < 0 ? '↘ ' : ''}${formatPct(data.change)}`;
      if (el.className !== className) el.className = className;
      setTextIfChanged(el, text);
    });
    const priceEl = $('#metric-btc-price'); const ethEl = $('#metric-eth-price');
    if (symbol === 'BTCUSDT') {
      setMetric(priceEl, data.price); setChange($('#metric-btc-change'), data.change);
      setTextIfChanged($('#metric-btc-volume'), formatVolume(data.volume)); $('#btc-volume-bar').style.width = `${Math.min(100, Math.max(5, Math.log10(Math.max(10, data.volume)) / 12 * 100))}%`;
      if (state.selectedSymbol === symbol) { setTextIfChanged($('#chart-high'), formatPrice(data.high)); setTextIfChanged($('#chart-low'), formatPrice(data.low)); setTextIfChanged($('#chart-volume'), formatVolume(data.volume)); }
    } else if (symbol === 'ETHUSDT') { setMetric(ethEl, data.price); setChange($('#metric-eth-change'), data.change); const bar = $('.eth-bar span'); if (bar) bar.style.width = `${Math.min(100, Math.max(8, 50 + data.change * 4))}%`; }
    if (state.selectedSymbol === symbol) {
      setTextIfChanged($('#chart-current-price'), formatPrice(data.price)); setChange($('#chart-current-change'), data.change);
      setTextIfChanged($('#chart-high'), formatPrice(data.high)); setTextIfChanged($('#chart-low'), formatPrice(data.low)); setTextIfChanged($('#chart-volume'), formatVolume(data.volume));
    }
  }
  function setMetric(element, price) { setTextIfChanged(element, formatPrice(price)); }
  function setChange(element, change) { if (!element) return; const className = `metric-change ${pctClass(change)}`; const text = `${change > 0 ? '↗ ' : change < 0 ? '↘ ' : ''}${formatPct(change)}`; if (element.className !== className) element.className = className; setTextIfChanged(element, text); }
  function renderAllPrices() { renderTickerRail(); renderMarketCards(); renderAssetTable(); renderPulseAssets(); updateHeroFromPrices(); updateChartHeader(); if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } }); }
  function renderTickerRail() {
    const track = $('#ticker-track'); track.innerHTML = ASSETS.map(asset => { const data = state.prices[asset.symbol]; return `<div class="ticker-item"><strong>${asset.ticker}</strong><span data-price-for="${asset.symbol}" data-last-value="${data?.price || 0}">${formatPrice(data?.price)}</span><span data-change-for="${asset.symbol}" class="ticker-change ${pctClass(data?.change)}">${escapeHTML(formatPct(data?.change))}</span></div>`; }).join('');
  }
  function renderMarketCards() {
    const host = $('#asset-cards'); host.innerHTML = ASSETS.slice(0, 4).map(asset => {
      const data = state.prices[asset.symbol] || {}; const favorite = state.watchlist.includes(asset.symbol);
      return `<article class="asset-card" data-select-asset="${asset.symbol}" tabindex="0" role="button" aria-label="Abrir gráfico de ${asset.name}"><div class="asset-card-top">${avatarHTML(asset)}<div class="asset-name"><strong>${asset.name}</strong><small>${asset.ticker} / USDT</small></div><button class="asset-fav ${favorite ? 'is-favorite' : ''}" data-favorite="${asset.symbol}" type="button" title="${favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" aria-label="${favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" aria-pressed="${favorite}"> <i data-lucide="bookmark"></i></button></div><div class="asset-price" data-price-for="${asset.symbol}" data-last-value="${data.price || 0}">${formatPrice(data.price)}</div><div class="asset-bottom">${changeHTML(data.change, `data-change-for="${asset.symbol}"`)}<span>24H CHANGE</span></div><div class="asset-card-foot"></div></article>`;
    }).join('');
    host.querySelectorAll('.asset-card').forEach(card => { card.addEventListener('click', event => { if (event.target.closest('[data-favorite]')) return; selectAsset(card.dataset.selectAsset); $('#markets').scrollIntoView({ behavior: 'smooth', block: 'start' }); }); card.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); selectAsset(card.dataset.selectAsset); } }); });
  }
  function renderPulseAssets() {
    $('#pulse-assets').innerHTML = ASSETS.map(asset => { const data = state.prices[asset.symbol] || {}; return `<div class="pulse-row"><div class="pulse-asset"><span class="pulse-mini-icon">${escapeHTML(asset.glyph)}</span><span><strong>${asset.ticker}</strong><small data-pulse-price="${asset.symbol}">${formatPrice(data.price)}</small></span></div>${changeHTML(data.change, `data-pulse-change="${asset.symbol}"`)}</div>`; }).join('');
    updateRadarValues();
  }
  function updateHeroFromPrices() {
    const btc = state.prices.BTCUSDT; const eth = state.prices.ETHUSDT;
    if (btc) { setMetric($('#metric-btc-price'), btc.price); setChange($('#metric-btc-change'), btc.change); $('#metric-btc-volume').textContent = formatVolume(btc.volume); $('#btc-volume-bar').style.width = `${Math.min(100, Math.max(5, Math.log10(Math.max(10, btc.volume)) / 12 * 100))}%`; }
    if (eth) { setMetric($('#metric-eth-price'), eth.price); setChange($('#metric-eth-change'), eth.change); const bar = $('.eth-bar span'); if (bar) bar.style.width = `${Math.min(100, Math.max(8, 50 + eth.change * 4))}%`; }
    updateRadarValues();
  }
  function updateRadarValues() {
    const known = ASSETS.filter(asset => state.prices[asset.symbol]); if (!known.length) return;
    const signature = known.map(asset => { const change = numeric(state.prices[asset.symbol].change); return change > 0 ? '+' : change < 0 ? '-' : '0'; }).join('');
    if (signature === state.lastRadarSignature) return;
    state.lastRadarSignature = signature;
    const positives = known.filter(asset => numeric(state.prices[asset.symbol].change) > 0).length; const negatives = known.filter(asset => numeric(state.prices[asset.symbol].change) < 0).length;
    $('#radar-number').innerHTML = `${positives}<span> / ${known.length}</span>`; $('#radar-label').textContent = positives === known.length ? 'Alta general' : positives > negatives ? 'Viés positivo' : negatives > positives ? 'Viés negativo' : 'Mercado misto';
    $('#radar-desc').textContent = `${positives} em alta · ${negatives} em queda`;
    $('#sentiment-track').innerHTML = known.map(asset => `<span class="${numeric(state.prices[asset.symbol].change) > 0 ? 'positive' : numeric(state.prices[asset.symbol].change) < 0 ? 'negative' : ''}" title="${asset.ticker}: ${formatPct(state.prices[asset.symbol].change)}"></span>`).join('');
    const percent = Math.round(positives / known.length * 100); $('#gauge-percent').textContent = `${percent}%`; $('.pulse-gauge').style.background = `conic-gradient(var(--green) ${percent * 3.6}deg,rgba(90,111,145,.15) 0deg)`;
    $('#pulse-title').textContent = percent >= 70 ? 'Compradores dominam' : percent >= 51 ? 'Viés comprador' : percent <= 30 ? 'Vendedores dominam' : percent <= 49 ? 'Viés vendedor' : 'Forças equilibradas';
    $('#pulse-text').textContent = `${positives} dos ${known.length} ativos monitorados estão positivos nas últimas 24 horas.`;
  }
  function renderAssetTable() {
    const needle = state.assetSearch.toLowerCase(); let assets = ASSETS.filter(asset => `${asset.name} ${asset.ticker} ${asset.symbol}`.toLowerCase().includes(needle));
    if (state.assetFilter === 'favorites') assets = assets.filter(asset => state.watchlist.includes(asset.symbol));
    if (state.assetFilter === 'gainers') assets = assets.filter(asset => numeric(state.prices[asset.symbol]?.change) > 0).sort((a, b) => numeric(state.prices[b.symbol]?.change) - numeric(state.prices[a.symbol]?.change));
    $('#favorites-count').textContent = state.watchlist.length;
    const body = $('#asset-table-body');
    if (!assets.length) { body.innerHTML = `<tr><td colspan="7" class="table-empty">${state.assetFilter === 'favorites' ? 'Nenhum favorito ainda. Use o ícone de marcador em um ativo para adicioná-lo aqui.' : 'Nenhum ativo encontrado para essa busca.'}</td></tr>`; return; }
    body.innerHTML = assets.map(asset => { const data = state.prices[asset.symbol] || {}; const favorite = state.watchlist.includes(asset.symbol); return `<tr data-select-asset="${asset.symbol}"><td><div class="table-coin">${avatarHTML(asset)}<span><strong>${asset.name}</strong><small>${asset.ticker} / USDT</small></span></div></td><td data-price-for="${asset.symbol}" data-last-value="${data.price || 0}">${formatPrice(data.price)}</td><td class="table-change ${pctClass(data.change)}" data-change-cell="${asset.symbol}">${formatPct(data.change)}</td><td data-high-for="${asset.symbol}">${formatPrice(data.high)}</td><td data-low-for="${asset.symbol}">${formatPrice(data.low)}</td><td data-volume-for="${asset.symbol}">${formatVolume(data.volume)}</td><td><button class="table-fav ${favorite ? 'is-favorite' : ''}" data-favorite="${asset.symbol}" type="button" aria-label="${favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" aria-pressed="${favorite}" title="${favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}"><i data-lucide="bookmark"></i></button></td></tr>`; }).join('');
    body.querySelectorAll('tr[data-select-asset]').forEach(row => row.addEventListener('click', event => { if (event.target.closest('[data-favorite]')) return; selectAsset(row.dataset.selectAsset); $('#candlestick-chart').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }
  function updateTickerDOMForTables(symbol) {
    const data = state.prices[symbol]; if (!data) return;
    const changeClass = `table-change ${pctClass(data.change)}`;
    const changeText = formatPct(data.change);
    $$(`[data-change-cell="${symbol}"]`).forEach(el => { if (el.className !== changeClass) el.className = changeClass; setTextIfChanged(el, changeText); });
    $$(`[data-pulse-price="${symbol}"]`).forEach(el => setTextIfChanged(el, formatPrice(data.price)));
    $$(`[data-pulse-change="${symbol}"]`).forEach(el => {
      const className = `metric-change ${pctClass(data.change)}`;
      const text = `${data.change > 0 ? '↗ ' : data.change < 0 ? '↘ ' : ''}${formatPct(data.change)}`;
      if (el.className !== className) el.className = className;
      setTextIfChanged(el, text);
    });
    $$(`[data-high-for="${symbol}"]`).forEach(el => setTextIfChanged(el, formatPrice(data.high)));
    $$(`[data-low-for="${symbol}"]`).forEach(el => setTextIfChanged(el, formatPrice(data.low)));
    $$(`[data-volume-for="${symbol}"]`).forEach(el => setTextIfChanged(el, formatVolume(data.volume)));
    const now = Date.now();
    if (now - state.lastTableUpdateAt >= 5000) {
      setTextIfChanged($('#table-updated'), `Atualizado às ${new Date(now).toLocaleTimeString('pt-BR')}`);
      state.lastTableUpdateAt = now;
    }
  }
  const baseUpdateTickerDOM = updateTickerDOM;
  updateTickerDOM = function(symbol) { baseUpdateTickerDOM(symbol); updateTickerDOMForTables(symbol); };

  function updateChartHeader() {
    const asset = assetFor(state.selectedSymbol); const data = state.prices[asset.symbol] || {};
    $('#chart-asset-title').innerHTML = `${escapeHTML(asset.name)} <small>${asset.ticker} / USDT</small>`;
    $('#chart-coin-symbol').className = `coin-avatar ${asset.className}`; $('#chart-coin-symbol').textContent = asset.glyph;
    $('#chart-current-price').textContent = formatPrice(data.price); setChange($('#chart-current-change'), data.change);
    $('#chart-high').textContent = formatPrice(data.high); $('#chart-low').textContent = formatPrice(data.low); $('#chart-volume').textContent = formatVolume(data.volume);
  }
  async function loadCandles() {
    const requestId = ++state.chartRequestId; const symbol = state.selectedSymbol; const interval = state.interval;
    $('#candlestick-chart').innerHTML = '<div class="chart-loading"><span class="loading-spinner"></span><span>Carregando candles…</span></div>';
    if (!state.chartLibraryFailed && state.chart) {
      try { state.chart.remove(); } catch {}
      state.chart = null; state.candleSeries = null; state.volumeSeries = null;
    }
    if (window.LightweightCharts && !state.chartLibraryFailed) initChart();
    try {
      const rows = await fetchJSON(`${API}/klines?symbol=${symbol}&interval=${interval}&limit=120`, 12000);
      if (requestId !== state.chartRequestId) return;
      state.candles = rows.map(row => ({ time: Math.floor(Number(row[0]) / 1000), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) })).filter(row => row.time && [row.open,row.high,row.low,row.close,row.volume].every(Number.isFinite));
      if (!state.candles.length) throw new Error('Sem candles para este intervalo');
      if (state.chart && state.candleSeries && state.volumeSeries) {
        $('#fallback-chart').hidden = true;
        state.candleSeries.setData(state.candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
        const palette = chartPalette();
        state.volumeSeries.setData(state.candles.map(candle => ({ time: candle.time, value: candle.volume, color: candle.close >= candle.open ? palette.upVolume : palette.downVolume })));
        state.chart.timeScale().fitContent();
      } else { drawFallbackChart(); }
      connectKlineSocket();
    } catch (error) {
      console.warn('Candle API failed:', error);
      if (requestId !== state.chartRequestId) return;
      if (!state.candles.length) $('#candlestick-chart').innerHTML = '<div class="chart-loading"><span>Não foi possível carregar candles. O painel tentará novamente.</span></div>';
      else toast('Gráfico em modo de contingência', 'Não foi possível atualizar o histórico de candles.', true);
      drawFallbackChart();
      if (state.chartRetry) clearTimeout(state.chartRetry);
      state.chartRetry = setTimeout(loadCandles, 12000);
    }
  }
  function connectKlineSocket() {
    if (state.socket) { const previous = state.socket; state.socket = null; try { previous.close(); } catch {} }
    const symbol = state.selectedSymbol.toLowerCase(); const interval = state.interval;
    let socket;
    try { socket = new WebSocket(`wss://data-stream.binance.vision/ws/${symbol}@kline_${interval}`); }
    catch { scheduleKlineReconnect(); return; }
    state.socket = socket;
    socket.onmessage = event => {
      try {
        const payload = JSON.parse(event.data); if (!payload.k) return; const k = payload.k;
        const candle = { time: Math.floor(Number(k.t) / 1000), open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v) };
        const previous = state.candles[state.candles.length - 1];
        if (previous && previous.time === candle.time) state.candles[state.candles.length - 1] = candle;
        else if (!previous || candle.time > previous.time) state.candles.push(candle);
        if (state.candles.length > 150) state.candles = state.candles.slice(-150);
        if (state.candleSeries) state.candleSeries.update({ time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
        if (state.volumeSeries) { const palette = chartPalette(); state.volumeSeries.update({ time: candle.time, value: candle.volume, color: candle.close >= candle.open ? palette.upVolume : palette.downVolume }); }
        if (state.chartLibraryFailed) drawFallbackChart();
      } catch (error) { console.warn('Bad kline payload:', error); }
    };
    socket.onclose = () => { if (state.socket === socket) { state.socket = null; scheduleKlineReconnect(); } };
  }
  function scheduleKlineReconnect() { if (state.klineRetry) clearTimeout(state.klineRetry); state.klineRetry = setTimeout(() => { if (!state.socket) connectKlineSocket(); }, 5000); }
  function drawFallbackChart() {
    const canvas = $('#fallback-chart'); const holder = $('#candlestick-chart'); if (!canvas || !state.candles.length) return;
    if (state.chartLibraryFailed) holder.innerHTML = '';
    canvas.hidden = false; canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.position = 'absolute'; canvas.style.inset = '0';
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const palette = chartPalette();
    const width = holder.clientWidth || 600; const height = holder.clientHeight || 300; const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.scale(dpr, dpr); ctx.clearRect(0,0,width,height);
    const data = state.candles.slice(-75); if (!data.length) return;
    const lo = Math.min(...data.map(d=>d.low)); const hi = Math.max(...data.map(d=>d.high)); const pad = (hi-lo)*.08 || hi*.01; const min=lo-pad, max=hi+pad;
    const left=8,right=66,top=16,bottom=26,volumeH=height*.17, chartBottom=height-bottom-volumeH, chartH=chartBottom-top, usableW=width-left-right, slot=usableW/data.length, candleW=Math.max(2,Math.min(9,slot*.64));
    const maxVolume = Math.max(1, ...data.map(d => d.volume));
    ctx.font='9px "DM Mono", monospace'; ctx.strokeStyle=palette.grid; ctx.fillStyle=palette.text; ctx.lineWidth=1;
    for(let i=0;i<5;i++){const y=top+(chartH/4)*i;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right+3,y);ctx.stroke();const value=max-(max-min)*i/4;ctx.fillText(formatPrice(value),width-right+8,y+3);}
    const yOf=value=>top+(max-value)/(max-min)*chartH;
    data.forEach((candle,index)=>{const x=left+slot*index+slot/2;const up=candle.close>=candle.open;const color=up?palette.up:palette.down;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,yOf(candle.high));ctx.lineTo(x,yOf(candle.low));ctx.stroke();const y1=yOf(Math.max(candle.open,candle.close)),y2=yOf(Math.min(candle.open,candle.close));ctx.fillRect(x-candleW/2,y1,candleW,Math.max(1.3,y2-y1));const vh=(candle.volume/maxVolume)*volumeH*.75;ctx.globalAlpha=.35;ctx.fillRect(x-candleW/2,chartBottom+volumeH-vh,candleW,vh);ctx.globalAlpha=1;});
    ctx.fillStyle=palette.text;ctx.font='8px "DM Mono",monospace';const marks=[0,Math.floor(data.length*.33),Math.floor(data.length*.66),data.length-1];marks.forEach(index=>{const d=data[index];if(!d)return;const date=new Date(d.time*1000);const label=state.interval.endsWith('d')||state.interval==='1w'?`${date.getDate()}/${date.getMonth()+1}`:`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;ctx.fillText(label,left+slot*index,height-6);});
  }
  function selectAsset(symbol) {
    if (!ASSETS.some(asset => asset.symbol === symbol)) return;
    if (state.selectedSymbol === symbol) { $('#chart-asset-select').value = symbol; return; }
    state.selectedSymbol = symbol; $('#chart-asset-select').value = symbol; updateChartHeader(); loadCandles();
  }

  async function loadNews({ manual = false } = {}) {
    if (state.newsLoading) return;
    state.newsLoading = true;
    const button = $('#refresh-news');
    button.classList.add('is-loading'); button.disabled = true;
    if (manual) $('#news-updated').textContent = 'Atualizando fontes…';
    let sourceStatuses = [];
    let payload = null;
    try {
      // Primary path: same-origin Cloudflare Worker/Pages Function.
      try {
        const response = await fetch(`/api/news${manual ? `?refresh=1&t=${Date.now()}` : ''}`, {
          cache: 'no-store', headers: { 'Accept': 'application/json' }
        });
        const body = await response.json();
        if (!response.ok && !Array.isArray(body.items)) throw new Error(`News endpoint HTTP ${response.status}`);
        payload = body;
        sourceStatuses = Array.isArray(body.sources) ? body.sources : [];
      } catch (endpointError) {
        console.warn('KANDLE /api/news indisponível; tentando agregador alternativo:', endpointError);
      }

      // If the server route itself is missing or all upstream feeds failed, try a public RSS-to-JSON relay.
      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        const results = await Promise.allSettled(NEWS_FEEDS.map(async feed => {
          const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=20`;
          const json = await fetchJSON(endpoint, 10000);
          if (json.status !== 'ok' || !Array.isArray(json.items) || !json.items.length) throw new Error(`Sem itens de ${feed.label}`);
          return {
            key: feed.key, label: feed.label, ok: true, via: 'rss2json', count: json.items.length,
            items: json.items.map(item => ({
              id: hash(`${item.link || ''}|${item.title || ''}`),
              title: stripHTML(item.title || ''), description: stripHTML(item.description || item.content || ''),
              url: safeNewsURL(item.link), source: stripHTML(item.author || item.feed?.title || feed.label).slice(0, 70) || feed.label,
              published: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(), category: feed.key,
              categoryLabel: feed.label
            }))
          };
        }));
        const fallbackItems = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value.items);
        const fallbackSources = results.map((result, index) => result.status === 'fulfilled'
          ? { key: NEWS_FEEDS[index].key, label: NEWS_FEEDS[index].label, ok: true, via: 'rss2json', count: result.value.items.length }
          : { key: NEWS_FEEDS[index].key, label: NEWS_FEEDS[index].label, ok: false, via: 'rss2json', count: 0, error: String(result.reason?.message || 'Falha no agregador').slice(0, 100) });
        if (fallbackItems.length) {
          payload = { items: fallbackItems, sources: fallbackSources, updatedAt: Date.now(), partial: fallbackSources.some(source => !source.ok) };
          sourceStatuses = fallbackSources;
        } else if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
          payload = { items: [], sources: fallbackSources, error: 'As fontes não responderam.' };
          sourceStatuses = fallbackSources;
        }
      }

      sourceStatuses = Array.isArray(payload?.sources) && payload.sources.length ? payload.sources : sourceStatuses;
      const normalized = (payload?.items || []).map(item => {
        const category = ['brasil', 'crypto', 'global'].includes(item.category) ? item.category : 'global';
        const dateValue = item.published ?? item.pubDate ?? item.publishedAt;
        let published = typeof dateValue === 'number' ? dateValue : new Date(dateValue || Date.now()).getTime();
        if (!Number.isFinite(published) || published <= 0) published = Date.now();
        const title = stripHTML(item.title || '');
        const description = stripHTML(item.description || item.summary || item.content || '');
        const url = safeNewsURL(item.url || item.link || '');
        const source = stripHTML(item.source || item.author || item.publisher || category.toUpperCase()).slice(0, 70) || category.toUpperCase();
        const categoryLabel = item.categoryLabel || (category === 'brasil' ? 'BRASIL' : category === 'crypto' ? 'CRIPTO' : 'GLOBAL');
        return { id: String(item.id || hash(`${url}|${title}`)), title, description, url, source, published, category, categoryLabel };
      }).filter(item => item.title && item.url);
      const unique = new Map();
      normalized.sort((a, b) => b.published - a.published).forEach(item => {
        const dedupeKey = item.title.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
        if (dedupeKey && !unique.has(dedupeKey)) unique.set(dedupeKey, { ...item, id: item.id || hash(dedupeKey) });
      });
      const finalItems = [...unique.values()].slice(0, 60);
      state.newsSources = sourceStatuses;
      if (finalItems.length) {
        if (state.newsInitialized && state.breakingEnabled) {
          const known = new Set(state.seenNews);
          const candidates = finalItems.filter(item => !known.has(item.id) && isBreaking(item) && Date.now() - item.published < 8 * 60 * 60 * 1000);
          candidates.slice(0, 2).forEach(item => state.breakingQueue.push(item));
        }
        state.news = finalItems;
        state.newsInitialized = true;
        state.seenNews = [...new Set([...finalItems.map(item => item.id), ...state.seenNews])].slice(0, 300);
        writeJSON('kandle-seen-news', state.seenNews);
        renderNews();
        const goodSources = sourceStatuses.filter(source => source.ok).length;
        const sourceCount = sourceStatuses.length || NEWS_FEEDS.length;
        $('#news-source-status').textContent = `${goodSources}/${sourceCount} FONTES OK`;
        $('#news-updated').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
        if (state.breakingQueue.length && !state.breakingActive) showNextBreaking();
        if (manual) toast('Feed atualizado', `${finalItems.length} manchetes consolidadas.`);
      } else {
        state.news = [];
        state.newsInitialized = true;
        renderNews();
        const goodSources = sourceStatuses.filter(source => source.ok).length;
        $('#news-source-status').textContent = `${goodSources}/${sourceStatuses.length || NEWS_FEEDS.length} FONTES OK`;
        $('#news-updated').textContent = 'Sem manchetes · nova tentativa automática';
        if (manual) toast('Ainda sem manchetes', 'O servidor respondeu, mas as fontes RSS não entregaram itens. Veja o diagnóstico no painel.', true);
      }
    } catch (error) {
      console.warn('KANDLE news sync failed:', error);
      state.newsSources = sourceStatuses;
      if (!state.news.length) {
        $('#news-feed').innerHTML = `<div class="news-empty news-error"><strong>O radar ainda não conseguiu receber manchetes.</strong><span>A KANDLE tentou a rota do servidor e o agregador alternativo. Confira o diagnóstico das fontes abaixo ou tente novamente em instantes.</span>${renderSourceDiagnostics(sourceStatuses)}</div>`;
      }
      $('#news-source-status').textContent = 'TENTANDO NOVAMENTE';
      $('#news-updated').textContent = 'Falha na sincronização';
      if (manual) toast('Falha ao atualizar as notícias', 'Confira se /api/news está publicado no Cloudflare.', true);
    } finally {
      state.newsLoading = false; button.classList.remove('is-loading'); button.disabled = false;
    }
  }
  function renderSourceDiagnostics(sources = []) {
    if (!sources.length) return '<div class="source-diagnostics">Nenhum diagnóstico retornado pelo servidor.</div>';
    return `<div class="source-diagnostics">${sources.map(source => `<span class="source-diagnostic ${source.ok ? 'is-ok' : 'is-failed'}"><i></i><b>${escapeHTML(source.label || source.key || 'Fonte')}</b><small>${source.ok ? `${Number(source.count) || 0} itens` : escapeHTML(source.error || 'indisponível')}</small></span>`).join('')}</div>`;
  }
  function safeNewsURL(value) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
  function hash(value) { let h = 2166136261; for (let i=0; i<value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  function isBreaking(item) { const text = `${item.title} ${item.description}`; return HIGH_PRIORITY.test(text); }
  function formatNewsTime(timestamp) {
    const date = new Date(timestamp); if (Number.isNaN(date.getTime())) return 'AGORA';
    const delta = Math.max(0, Date.now() - date.getTime()); const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'AGORA'; if (minutes < 60) return `${minutes} MIN`;
    const hours = Math.floor(minutes/60); if (hours < 24) return `${hours}H ATRÁS`;
    return date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','').toUpperCase();
  }
  function renderNews({ preserveScroll = true } = {}) {
    const feedElement = $('#news-feed');
    const previousScrollTop = feedElement ? feedElement.scrollTop : 0;
    const filter = state.newsFilter; const filtered = state.news.filter(item => filter === 'all' || item.category === filter);
    const navNewsCount = $('#news-count'); if (navNewsCount) navNewsCount.textContent = state.news.length || '—';
    $('#all-news-count').textContent = state.news.length;
    if (!filtered.length) {
      const empty = state.news.length
        ? `<div class="news-empty"><strong>Sem manchetes para este filtro.</strong>Troque a categoria ou atualize as fontes de notícias.</div>`
        : `<div class="news-empty news-error"><strong>O radar ainda não recebeu manchetes.</strong><span>As cotações continuam funcionando; as notícias dependem das fontes externas. Use atualizar para tentar de novo.</span>${renderSourceDiagnostics(state.newsSources)}</div>`;
      $('#news-feed').innerHTML = empty;
      if (feedElement) feedElement.scrollTop = preserveScroll ? previousScrollTop : 0;
      return;
    }
    $('#news-feed').innerHTML = filtered.slice(0, 24).map(item => {
      const breaking = isBreaking(item); const time = formatNewsTime(item.published); const description = item.description.length > 240 ? item.description.slice(0, 237) + '…' : item.description;
      const tagClass = item.category === 'brasil' ? 'tag-brasil' : item.category === 'global' ? 'tag-global' : '';
      return `<article class="news-item ${breaking ? 'urgent-news' : ''}"><div class="news-timebox"><strong>${escapeHTML(time.split(' ')[0])}</strong><span>${escapeHTML(time.includes('ATRÁS') ? 'ATRÁS' : time.includes('MIN') ? 'MINUTOS' : time === 'AGORA' ? 'AGORA' : 'PUBLICADO')}</span></div><div class="news-body"><div class="news-meta"><span class="news-tag ${tagClass}">${escapeHTML(item.categoryLabel)}</span>${breaking ? '<span class="news-tag tag-breaking">RADAR</span>' : ''}<span class="news-source">${escapeHTML(item.source)}</span></div><h3>${escapeHTML(item.title)}</h3>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>${item.url ? `<a class="news-open" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" title="Abrir matéria"><i data-lucide="arrow-up-right"></i></a>` : ''}</article>`;
    }).join('');
    if (feedElement) feedElement.scrollTop = preserveScroll ? previousScrollTop : 0;
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }
  function showNextBreaking() {
    if (!state.breakingEnabled || state.breakingActive || !state.breakingQueue.length) return;
    const item = state.breakingQueue.shift(); showBreaking(item);
  }
  function showBreaking(item) {
    if (!state.breakingEnabled) return;
    state.breakingActive = true;
    playBreakingSting();
    const overlay = $('#breaking-overlay'); const host = $('#breaking-content'); overlay.classList.add('active'); overlay.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden';
    host.innerHTML = `<div class="breaking-intro"><div class="breaking-label"><i></i> KANDLE ALERT SYSTEM · LIVE</div><h2>BREAKING<span>NEWS</span></h2><p>EVENTO RELEVANTE DETECTADO · PREPARANDO RESUMO</p><div class="breaking-progress"><span></span></div></div>`;
    clearBreakingTimers();
    state.breakingTimers.push(setTimeout(() => {
      const source = `${item.source} · ${formatNewsTime(item.published)}`;
      host.innerHTML = `<article class="breaking-story"><div class="breaking-label"><i></i> ALERTA DE MERCADO DETECTADO</div><div class="story-source">${escapeHTML(source.toUpperCase())}</div><h2 id="breaking-title">${escapeHTML(item.title)}</h2><p>${escapeHTML(item.description || 'Uma nova manchete relevante foi detectada pelas fontes monitoradas. Abra a matéria para consultar os detalhes e o contexto.')}</p><div class="story-rule"></div><div class="story-actions">${item.url ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i> Ler matéria completa</a>` : ''}<button type="button" id="close-breaking"><i data-lucide="check"></i> Continuar monitorando</button></div><div class="story-foot">KANDLE · ALERTA AUTOMÁTICO DE MANCHETES · NÃO É RECOMENDAÇÃO FINANCEIRA</div></article>`;
      if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
      $('#close-breaking')?.addEventListener('click', closeBreaking);
    }, 2650));
  }
  function clearBreakingTimers() { state.breakingTimers.forEach(timer => clearTimeout(timer)); state.breakingTimers = []; }
  function closeBreaking() {
    clearBreakingTimers(); const overlay = $('#breaking-overlay'); overlay.classList.remove('active'); overlay.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; $('#breaking-content').innerHTML = ''; state.breakingActive = false;
    if (state.breakingEnabled && state.breakingQueue.length) setTimeout(showNextBreaking, 600);
  }
  function toggleFavorite(symbol) {
    state.watchlist = state.watchlist.includes(symbol) ? state.watchlist.filter(item => item !== symbol) : [...state.watchlist, symbol]; writeJSON('kandle-watchlist', state.watchlist);
    renderMarketCards(); renderAssetTable(); toast(state.watchlist.includes(symbol) ? 'Ativo adicionado à watchlist' : 'Ativo removido da watchlist', assetFor(symbol).name);
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }
  function setBreakingEnabled(enabled) {
    state.breakingEnabled = enabled; writeJSON('kandle-breaking-enabled', enabled); const btn = $('#alerts-toggle'); btn.classList.toggle('alerts-active', enabled); btn.classList.toggle('alerts-paused', !enabled); btn.setAttribute('aria-pressed', String(enabled)); btn.title = enabled ? 'Alertas de breaking news ativos' : 'Alertas de breaking news pausados';
    if (!enabled) { state.breakingQueue = []; if (state.breakingActive) closeBreaking(); }
    toast(enabled ? 'Alertas ativados' : 'Alertas pausados', enabled ? 'Novas manchetes relevantes poderão abrir o modo breaking news.' : 'O feed continua atualizando sem abrir a animação de tela cheia.');
  }
  function showMacroFallback(container, message = 'Abra este instrumento diretamente no TradingView.') {
    const host = container.querySelector('.tradingview-widget-container__widget');
    const link = container.closest('.macro-widget-card')?.querySelector('.macro-widget-head a');
    if (!host || host.dataset.fallbackShown === 'true') return;
    host.dataset.fallbackShown = 'true';
    host.innerHTML = `<div class="macro-widget-fallback"><i data-lucide="external-link"></i><strong>Visualização incorporada indisponível</strong><span>${escapeHTML(message)}</span>${link ? `<a href="${escapeHTML(link.href)}" target="_blank" rel="noopener noreferrer">Abrir no TradingView <i data-lucide="arrow-up-right"></i></a>` : ''}</div>`;
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }
  function initializeMacroWidgets() {
    const isLight = document.documentElement.dataset.theme === 'light';
    const widgetTheme = isLight ? 'light' : 'dark';
    const accent = isLight ? '#00788B' : '#55F3FF';
    const widgetBackground = isLight ? '#FFFFFF' : '#20242B';
    const widgetText = isLight ? '#17202D' : '#F2F5FD';
    const widgetMuted = isLight ? '#566171' : '#AEB8C8';
    $$('.macro-widget-card .tradingview-widget-container[data-tv-symbol]').forEach(container => {
      if (container.dataset.tvInitialized === 'true' && container.dataset.tvTheme === widgetTheme) return;
      const host = container.querySelector('.tradingview-widget-container__widget');
      if (!host || !container.dataset.tvSymbol) return;
      container.querySelectorAll('iframe, script').forEach(element => element.remove());
      host.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'macro-widget-loading';
      loading.textContent = 'Carregando cotação…';
      host.appendChild(loading);
      container.dataset.tvInitialized = 'true';
      container.dataset.tvTheme = widgetTheme;
      const generation = Number(container.dataset.tvGeneration) || 0;
      const expectedTheme = widgetTheme;
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
      // The embed is cross-origin, so its colors must be passed in the widget config.
      // A CSS background alone cannot recolor the iframe contents.
      script.innerHTML = JSON.stringify({
        symbol: container.dataset.tvSymbol,
        width: '100%',
        height: '100%',
        locale: 'br',
        dateRange: '1D',
        colorTheme: widgetTheme,
        backgroundColor: widgetBackground,
        widgetFontColor: widgetText,
        fontColor: widgetMuted,
        isTransparent: false,
        trendLineColor: accent,
        underLineColor: accent,
        underLineBottomColor: isLight ? 'rgba(0,120,139,0)' : 'rgba(85,243,255,0)',
        isTransparent: false,
        autosize: true,
        largeChartUrl: ''
      });
      script.onerror = () => {
        if (Number(container.dataset.tvGeneration || 0) === generation && document.documentElement.dataset.theme === expectedTheme) showMacroFallback(container);
      };
      container.appendChild(script);
      // Avoid a stale timeout replacing a newer widget after the user switches themes quickly.
      window.setTimeout(() => {
        if (Number(container.dataset.tvGeneration || 0) !== generation || document.documentElement.dataset.theme !== expectedTheme) return;
        if (!container.querySelector('iframe') && !container.querySelector('.macro-widget-fallback')) {
          showMacroFallback(container, 'O widget demorou a carregar ou o provedor não permite este símbolo incorporado.');
        }
      }, 12000);
    });
  }
  function pageFromHash() {
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash === 'page-markets' || hash === 'markets' || hash === 'macro-radar') return 'markets';
    if (hash === 'page-watchlist' || hash === 'watchlist') return 'watchlist';
    return 'news';
  }
  function navigatePage(page, { scroll = true } = {}) {
    const validPages = ['news', 'markets', 'watchlist'];
    if (!validPages.includes(page)) page = 'news';
    $$('.page-view').forEach(view => {
      const active = view.dataset.pageView === page;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });
    $$('[data-page-link]').forEach(link => {
      const active = link.dataset.pageLink === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const labels = { news: 'NOTÍCIAS', markets: 'MERCADOS', watchlist: 'WATCHLIST' };
    const breadcrumb = $('#page-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = labels[page];
    document.body.dataset.currentPage = page;
    if (scroll) window.scrollTo({ top: 0, behavior: page === 'news' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (page === 'news' && scroll) { const feed = $('#news-feed'); if (feed) feed.scrollTop = 0; }
    if (page === 'markets') requestAnimationFrame(() => {
      initializeMacroWidgets();
      const container = $('#candlestick-chart');
      if (state.chart && container?.clientWidth && container?.clientHeight) state.chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      if (state.chartLibraryFailed) drawFallbackChart();
    });
  }
  function initEvents() {
    $('#chart-asset-select').addEventListener('change', event => { state.selectedSymbol = event.target.value; updateChartHeader(); loadCandles(); });
    $('#timeframe-group').addEventListener('click', event => { const button = event.target.closest('button[data-interval]'); if (!button) return; state.interval = button.dataset.interval; $$('#timeframe-group button').forEach(btn => btn.classList.toggle('active', btn === button)); loadCandles(); });
    $('#news-filters').addEventListener('click', event => { const button = event.target.closest('button[data-news-filter]'); if (!button) return; state.newsFilter = button.dataset.newsFilter; $$('#news-filters button').forEach(btn => btn.classList.toggle('active', btn === button)); renderNews({ preserveScroll: false }); });
    $('#asset-filters').addEventListener('click', event => { const button = event.target.closest('button[data-asset-filter]'); if (!button) return; state.assetFilter = button.dataset.assetFilter; $$('#asset-filters button').forEach(btn => btn.classList.toggle('active', btn === button)); renderAssetTable(); });
    $('#asset-search').addEventListener('input', event => { state.assetSearch = event.target.value.trim(); renderAssetTable(); });
    document.addEventListener('click', event => { const button = event.target.closest('[data-favorite]'); if (button) { event.preventDefault(); event.stopPropagation(); toggleFavorite(button.dataset.favorite); } });
    $('#refresh-news').addEventListener('click', () => loadNews({ manual: true }));
    $('#alerts-toggle').addEventListener('click', () => setBreakingEnabled(!state.breakingEnabled));
    $('#theme-toggle').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
    $('#sound-toggle').addEventListener('click', async () => {
      state.breakingSoundEnabled = !state.breakingSoundEnabled;
      writeJSON('kandle-breaking-sound-enabled', state.breakingSoundEnabled);
      updateSoundToggle();
      if (!state.breakingSoundEnabled) {
        toast('Som desativado', 'Os alertas visuais continuarão funcionando normalmente.');
        return;
      }
      const unlocked = await unlockBreakingAudio();
      if (unlocked) {
        playBreakingSting();
        toast('Som ativado', 'Prévia da vinheta de alerta reproduzida.');
      } else {
        toast('Som habilitado', 'Interaja com a página e confira o volume do navegador para liberar o áudio.', true);
      }
    });
    const unlockOnFirstGesture = event => {
      if (event.target?.closest?.('#sound-toggle')) return;
      if (state.breakingSoundEnabled) void unlockBreakingAudio();
      document.removeEventListener('pointerdown', unlockOnFirstGesture, true);
      document.removeEventListener('keydown', unlockOnFirstGesture, true);
    };
    document.addEventListener('pointerdown', unlockOnFirstGesture, true);
    document.addEventListener('keydown', unlockOnFirstGesture, true);

    $$('[data-page-link]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      const page = link.dataset.pageLink;
      navigatePage(page);
      if (location.hash !== `#page-${page}`) history.pushState({ page }, '', `#page-${page}`);
    }));
    window.addEventListener('popstate', () => navigatePage(pageFromHash(), { scroll: true }));
    window.addEventListener('hashchange', () => navigatePage(pageFromHash(), { scroll: true }));
    $('#breaking-overlay').addEventListener('click', event => { if (event.target.id === 'breaking-overlay') closeBreaking(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.breakingActive) closeBreaking(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (!state.tickerSocket || state.tickerSocket.readyState > 1) connectTickerSocket(); } });
  }
  function initLucide() { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } }); }
  async function boot() {
    // KANDLE always opens on News, even if an old session left another page in the URL hash.
    setTheme(state.theme, { persist: false });
    navigatePage('news', { scroll: false });
    if (location.hash && location.hash !== '#page-news') history.replaceState({ page: 'news' }, '', `${location.pathname}${location.search}#page-news`);
    initDateClock(); initLucide(); initEvents(); updateSoundToggle();
    if (!state.breakingEnabled) setBreakingEnabled(false); else { const btn = $('#alerts-toggle'); btn.classList.add('alerts-active'); btn.setAttribute('aria-pressed','true'); }
    initChart();
    const priceLoad = loadTickers(); const newsLoad = loadNews();
    loadCandles(); connectTickerSocket();
    await Promise.allSettled([priceLoad, newsLoad]);
    state.refreshTimer = window.setInterval(() => loadNews(), 120000);
    window.setInterval(() => { if (!state.tickerSocket || state.tickerSocket.readyState > 1) loadTickers(); }, 30000);
    window.addEventListener('online', () => { toast('Conexão restaurada', 'Reconectando feeds de mercado.'); loadTickers(); loadNews(); connectTickerSocket(); });
    window.addEventListener('offline', () => { setConnection('Sem conexão com a internet', 'OFFLINE', false); toast('Você está offline', 'Os últimos dados carregados permanecem visíveis.', true); });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
