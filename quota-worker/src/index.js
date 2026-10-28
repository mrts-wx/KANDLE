const DEFAULT_GLOBAL_DAILY = 100;
const DEFAULT_USER_DAILY = 5;
const DEFAULT_IP_PER_MINUTE = 3;
const RETENTION_DAYS = 3;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function integer(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}
function utcDay(timestamp) { return new Date(timestamp).toISOString().slice(0, 10); }
function retryAtUtcTomorrow(timestamp) {
  const next = new Date(timestamp);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

// No public route is exposed for quota reservations. Pages reaches the Durable Object
// through its binding; direct requests to this Worker's public URL receive 404.
export default {
  async fetch() {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  },
};

export class KandleQuota {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/reserve') {
      return json({ error: 'Not found' }, 404);
    }
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (typeof body?.ipHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.ipHash)) {
      return json({ error: 'Invalid client fingerprint' }, 400);
    }

    const now = Number.isFinite(Date.parse(body.now)) ? Date.parse(body.now) : Date.now();
    const day = utcDay(now);
    const minute = Math.floor(now / 60000);
    const globalLimit = integer(body.globalDailyLimit, DEFAULT_GLOBAL_DAILY, 5000);
    const userLimit = integer(body.userDailyLimit, DEFAULT_USER_DAILY, 100);
    const minuteLimit = integer(body.ipPerMinuteLimit, DEFAULT_IP_PER_MINUTE, 60);
    const globalKey = `global:${day}`;
    const userKey = `user:${day}:${body.ipHash}`;
    const minuteKey = `minute:${minute}:${body.ipHash}`;
    let decision;

    // Durable Object storage transactions make the global and IP counters atomic,
    // even if many Cloudflare Pages instances receive requests concurrently.
    await this.state.storage.transaction(async tx => {
      const globalUsedRaw = await tx.get(globalKey);
      const userUsedRaw = await tx.get(userKey);
      const minuteUsedRaw = await tx.get(minuteKey);
      const globalUsed = Number(globalUsedRaw || 0);
      const userUsed = Number(userUsedRaw || 0);
      const minuteUsed = Number(minuteUsedRaw || 0);
      const resetAt = retryAtUtcTomorrow(now);

      if (globalUsed >= globalLimit) {
        decision = { allowed: false, code: 'GLOBAL_DAILY_LIMIT', error: 'A cota diária global da KANDLE AI acabou. A IA será reativada na próxima renovação da cota.', retryAt: resetAt };
        return;
      }
      if (userUsed >= userLimit) {
        decision = { allowed: false, code: 'IP_DAILY_LIMIT', error: 'Você atingiu o limite diário de perguntas gratuitas deste endereço de rede. Tente novamente após a renovação da cota.', retryAt: resetAt };
        return;
      }
      if (minuteUsed >= minuteLimit) {
        decision = { allowed: false, code: 'IP_MINUTE_LIMIT', error: 'Muitas perguntas em pouco tempo. Espere um minuto e tente novamente.', retryAt: new Date((minute + 1) * 60000).toISOString() };
        return;
      }

      await tx.put(globalKey, globalUsed + 1);
      await tx.put(userKey, userUsed + 1);
      await tx.put(minuteKey, minuteUsed + 1);
      decision = {
        allowed: true,
        remainingGlobal: Math.max(0, globalLimit - globalUsed - 1),
        remainingUser: Math.max(0, userLimit - userUsed - 1),
        resetAt,
      };
    });

    // Keep per-minute fingerprints briefly and daily counters for a few days only.
    const alarm = await this.state.storage.getAlarm();
    if (alarm === null) await this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);
    if (!decision?.allowed) {
      const status = decision?.code === 'GLOBAL_DAILY_LIMIT' || decision?.code === 'IP_DAILY_LIMIT' || decision?.code === 'IP_MINUTE_LIMIT' ? 429 : 503;
      return json(decision || { allowed: false, error: 'Quota unavailable' }, status);
    }
    return json(decision);
  }

  async alarm() {
    const now = Date.now();
    const day = utcDay(now);
    const oldestKeptDay = utcDay(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const minMinuteToKeep = Math.floor(now / 60000) - 2;
    const candidates = await this.state.storage.list();
    for (const key of candidates.keys()) {
      if (key.startsWith('global:') || key.startsWith('user:')) {
        const storedDay = key.split(':')[1];
        if (storedDay < oldestKeptDay || storedDay > day) await this.state.storage.delete(key);
      } else if (key.startsWith('minute:')) {
        const storedMinute = Number(key.split(':')[1]);
        if (!Number.isFinite(storedMinute) || storedMinute < minMinuteToKeep) await this.state.storage.delete(key);
      }
    }
    const remaining = await this.state.storage.list({ limit: 1 });
    if (remaining.size > 0) await this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);
  }
}
