import { onRequestGet as getNews } from './functions/api/news.js';
import { onRequestGet as getAIState, onRequestPost as postAI, onRequestOptions as optionsAI } from './functions/api/ai.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/news' && request.method === 'GET') {
      return getNews({ request, env, ctx });
    }

    if (url.pathname === '/api/ai') {
      if (request.method === 'GET') return getAIState({ request, env, ctx });
      if (request.method === 'POST') return postAI({ request, env, ctx });
      if (request.method === 'OPTIONS') return optionsAI({ request, env, ctx });
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, POST, OPTIONS' } });
    }

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, app: 'KANDLE', newsRoute: '/api/news', timestamp: Date.now() }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    // Serve the regular static frontend for all other requests.
    return env.ASSETS.fetch(request);
  }
};
