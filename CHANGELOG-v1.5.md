# KANDLE v1.5 — Fluid App

## Experiência e performance
- Agregação de mensagens de ticker em lotes (100 ms) antes de atualizar o DOM.
- Removida leitura síncrona de layout (`offsetWidth`) usada para reiniciar animações de preço.
- Market Pulse só atualiza quando muda a direção (alta/queda/neutro) dos ativos.
- Atualizações de texto condicionais para reduzir mutações desnecessárias.
- Gráfico de contingência evita recalcular o volume máximo para cada candle.
- Blur de backdrop, glows de fundo e animações infinitas foram reduzidos; preferência por movimento reduzido é respeitada globalmente.

## Temas
- Novo botão sol/lua para alternar entre branco/porcelana e cinza-chumbo.
- Tema fica persistido em `localStorage` e é aplicado antes de carregar o CSS, reduzindo flash de tema.
- Candles, labels e widgets TradingView seguem o tema atual.
- Correções de contraste para notícias, navegação, indicadores, tabela, popup de IA e estados vazios.

## Mantido
- KANDLE Breaking Sound, alertas globais, páginas Notícias/Mercados/Watchlist, favoritos, rotas de notícias e configuração de deploy do Worker.
