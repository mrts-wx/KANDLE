# KANDLE v1.2 — correções e refinamento visual

## Corrigido
- Favoritos usam sempre um ícone Lucide `bookmark`; o estado salvo fica verde-esmeralda com preenchimento e glow, sem trocar por `bookmarkCheck` nem criar o quadrado visual.
- Notícias são agregadas via `functions/api/news.js` no servidor do Cloudflare Pages, consultando feeds RSS em paralelo, normalizando XML/RSS/Atom e removendo duplicatas. A página usa `/api/news`; o fallback antigo RSS2JSON ficou só como contingência de preview/local.
- Cada página tem o seu espaço: Notícias (padrão), Mercados e Watchlist. Links laterais e mobile mudam de página e atualizam o histórico; não dependem de rolagem até uma seção distante.
- Breaking News permanece fora dos contêineres de página, por isso pode interromper qualquer tela quando uma manchete nova e relevante for detectada.
- Os quatro símbolos macro são widgets separados, com fallback de link para a página do instrumento, e só são inicializados quando Mercados fica visível. Isso evita que um símbolo inválido/indisponível impeça os outros de renderizar e evita inicialização com container oculto de largura zero.
- Visual refinado para Obsidian Glass & Liquid Bevel: base `#090A0C`, cards de vidro, bordas chanfradas, texto branco/cinza, verde `#00FF87`, vermelho `#FF2A6D` e acento dourado `#FFD700`.

## Verificações feitas
- `node --check app.js` e `node --check functions/api/news.js`.
- Teste de fixture RSS e mock do endpoint `/api/news` (normalização, remoção de tags e formato do JSON).
- Verificação de IDs HTML duplicados, referências estáticas do JavaScript e estrutura das três páginas.

## Ainda precisa do deploy real
A resposta dos feeds externos e os embeds TradingView precisam ser confirmados no seu domínio Cloudflare após o deploy, porque disponibilidade e restrições de terceiros variam. A verificação local do endpoint foi feita com feed simulado, sem alegar consulta real aos servidores RSS.
