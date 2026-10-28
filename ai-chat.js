(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const panel = $('#ai-panel');
  const launcher = $('#ai-launcher');
  const form = $('#ai-form');
  const input = $('#ai-input');
  const send = $('#ai-send');
  const messages = $('#ai-messages');
  if (!panel || !launcher || !form || !input || !send || !messages) return;
  let busy = false;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function openPanel() {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    window.setTimeout(() => input.focus(), 80);
  }
  function closePanel() {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }
  function pushMessage(role, content, options = {}) {
    const item = document.createElement('div');
    item.className = `ai-message ${role === 'user' ? 'ai-message-user' : 'ai-message-assistant'}${options.error ? ' ai-message-error' : ''}${options.typing ? ' ai-message-typing' : ''}`;
    if (options.typing) {
      item.innerHTML = `<span class="ai-message-avatar"><i data-lucide="sparkles"></i></span><div class="ai-message-bubble"><div class="ai-typing" aria-label="KANDLE está pensando"><span></span><span></span><span></span></div></div>`;
    } else {
      const avatar = role === 'user' ? 'user-round' : 'sparkles';
      item.innerHTML = `<span class="ai-message-avatar"><i data-lucide="${avatar}"></i></span><div class="ai-message-bubble"><p>${escapeHTML(content).replace(/\n/g, '<br>')}</p></div>`;
    }
    messages.appendChild(item);
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    messages.scrollTop = messages.scrollHeight;
    return item;
  }
  function getContext() {
    const metrics = $('.metrics-grid')?.innerText || '';
    const selected = $('#chart-asset-title')?.innerText || 'Não identificado';
    const current = $('#chart-current-price')?.innerText || 'indisponível';
    const change = $('#chart-current-change')?.innerText || 'indisponível';
    const interval = $('#timeframe-group button.active')?.innerText || '1H';
    const rows = $$('#asset-table-body tr').slice(0, 9).map(row => row.innerText.replace(/\s+/g, ' ').trim()).join('\n');
    const headlines = $$('#news-feed .news-item').slice(0, 8).map((item, index) => `${index + 1}. ${item.innerText.replace(/\s+/g, ' ').trim()}`).join('\n');
    return [
      `HORÁRIO LOCAL: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date())}`,
      `ATIVO SELECIONADO: ${selected}; último preço exibido: ${current}; variação mostrada: ${change}; intervalo do candle: ${interval}.`,
      `INDICADORES VISÍVEIS:\n${metrics}`,
      `TABELA DE ATIVOS:\n${rows || 'Sem linhas carregadas.'}`,
      `MANCHETES VISÍVEIS (títulos e resumos dos feeds):\n${headlines || 'Nenhuma manchete carregada.'}`
    ].join('\n\n').slice(0, 6500);
  }
  async function ask(question) {
    if (busy) return;
    const message = String(question || '').trim();
    if (!message) return;
    busy = true;
    input.value = '';
    send.disabled = true;
    $$('#ai-quick-prompts button').forEach(button => { button.disabled = true; });
    pushMessage('user', message);
    const typing = pushMessage('assistant', '', { typing: true });
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ message, context: getContext() })
      });
      let data = {};
      try { data = await response.json(); } catch { /* endpoint may be missing on static hosting */ }
      if (!response.ok) {
        const reason = data.error || (response.status === 404
          ? 'A rota da IA não está ativa neste host. Publique pela Cloudflare Pages e siga AI-SETUP.md para configurar o Workers AI.'
          : `O serviço de IA respondeu com erro (${response.status}).`);
        throw new Error(reason);
      }
      if (!data.answer || typeof data.answer !== 'string') throw new Error('A IA retornou uma resposta vazia. Tente novamente.');
      typing.remove();
      pushMessage('assistant', data.answer);
    } catch (error) {
      typing.remove();
      const message = error instanceof TypeError
        ? 'Não consegui acessar /api/ai. Em hospedagem estática pura, a integração precisa de um endpoint de servidor. Siga o arquivo AI-SETUP.md.'
        : error.message || 'Ocorreu uma falha inesperada. Tente novamente.';
      pushMessage('assistant', message, { error: true });
    } finally {
      busy = false;
      send.disabled = false;
      $$('#ai-quick-prompts button').forEach(button => { button.disabled = false; });
      input.focus();
    }
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  $('#ai-close').addEventListener('click', closePanel);
  form.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
  $('#ai-quick-prompts').addEventListener('click', event => {
    const button = event.target.closest('[data-ai-prompt]');
    if (button) { openPanel(); ask(button.dataset.aiPrompt); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) closePanel(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
  });
})();
