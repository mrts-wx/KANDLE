# KANDLE — Market Intelligence

Terminal responsivo para acompanhar criptoativos, candles, notícias financeiras, breaking news e uma watchlist. A camada de interface usa a identidade **Obsidian Glass & Liquid Bevel**: painel geral de vidro flutuante, reflexos chanfrados, bordas neon suaves e acentos financeiros em verde/vermelho. A KANDLE AI continua em modo de aviso de lançamento e não faz chamadas de inferência.

## O que existe no projeto

- Cotações públicas de BTC, ETH, SOL, BNB, XRP, DOGE, ADA e AVAX via Binance Spot + WebSocket.
- Candles OHLCV com seleção de ativo e intervalos.
- Notícias agregadas no servidor, com cinco fontes, deduplicação, status por origem e fallback de RSS para RSS2JSON quando a busca direta falhar.
- Breaking News global: a animação pode aparecer em qualquer página e está corrigida para não gerar barra de rolagem horizontal.
- Favoritos com um único ícone bookmark, preenchimento verde e glow, sem quadrado sobreposto.
- Três páginas independentes: Notícias (tela inicial), Mercados e Watchlist.
- Widgets TradingView isolados. Como alguns símbolos oficiais não podem ser mostrados dentro de widgets externos, Nasdaq e Dow usam instrumentos de referência incorporáveis e mantêm links aos símbolos originais; a interface explica essa diferença.
- Endpoint da KANDLE AI preparado para uso futuro, mas desabilitado por padrão.

## Estrutura

```text
.
├── index.html                 # interface
├── styles.css                 # estilos, vidro, animações e responsividade
├── app.js                     # dados, candles, navegação e breaking news
├── ai.js                      # popup de desenvolvimento; não chama IA
├── worker.js                  # roteia /api/news e serve os assets estáticos
├── wrangler.jsonc             # configuração Cloudflare Workers + Static Assets
├── .assetsignore              # evita publicar fontes/arquivos privados como assets
├── functions/api/news.js      # agregador RSS compartilhado entre Worker e Pages
├── functions/api/ai.js        # endpoint futuro de IA (bloqueado por padrão)
├── quota-worker/              # Durable Object para cotas futuras da IA
├── AI-SETUP.md                # guia de lançamento futuro do chatbot
└── MONETIZATION.md            # plano de monetização
```

## Deploy recomendado — Cloudflare Workers (domínio `workers.dev`)

Este repositório inclui `wrangler.jsonc` e `worker.js` porque a KANDLE está sendo servida no domínio `*.workers.dev`. O worker trata `/api/news` e repassa todas as outras URLs para o armazenamento de assets estáticos. As Functions de `functions/` continuam disponíveis para uma implantação Pages separada.

### Pelo painel Workers Builds ligado ao GitHub

1. Envie **todos os arquivos da raiz do ZIP** para a raiz do repositório privado, incluindo `worker.js`, `wrangler.jsonc`, `package.json` e `.assetsignore`.
2. Em **Workers & Pages**, abra o Worker conectado ao GitHub e confirme que o build usa a configuração Wrangler do repositório.
3. Use o comando de deploy `npm run deploy` (ou o equivalente exibido pelo painel de builds) e não informe um diretório público separado: o Wrangler lê `assets.directory` do `wrangler.jsonc`.
4. Após concluir o deploy, abra primeiro `https://SEU-WORKER.workers.dev/api/health`. Deve retornar JSON com `"ok": true`.
5. Depois abra `https://SEU-WORKER.workers.dev/api/news`. Deve retornar JSON com `items`, `sources`, `updatedAt` e `partial`. Cada fonte contém `ok`, `count` e, se falhar, `error`.
6. Abra a raiz do site e atualize com `Ctrl+F5`. Notícias é a tela inicial independentemente de um hash antigo na URL.

### Deploy local pelo Wrangler

É necessário Node.js e uma sessão autenticada na Cloudflare:

```bash
npm install
npx wrangler login
npm run dev
```

Teste `http://localhost:8787/api/health` e `http://localhost:8787/api/news`. Para publicar:

```bash
npm run deploy
```

O nome do Worker está configurado como `kandle` em `wrangler.jsonc`. Se o nome do Worker da sua conta for diferente, ajuste `name` antes de fazer deploy.

### Alternativa — Cloudflare Pages

Se preferir Pages em vez de Workers, configure preset None e output `.`. O arquivo `functions/api/news.js` é publicado como `/api/news` pelas Pages Functions. Não use a mesma configuração mental de um projeto Pages para um Worker `workers.dev`: a diferença entre os runtimes é importante para a rota de notícias.

## Diagnóstico de notícias

- `GET /api/health`: verifica se o Worker roteia requisições.
- `GET /api/ai`: mostra apenas se a funcionalidade de IA está ligada; deve retornar `enabled: false` neste lançamento. POST responde com estado de desenvolvimento (503) enquanto a chave de segurança estiver desligada.
- `GET /api/news`: consulta os feeds no servidor e retorna o status individual das fontes.
- O endpoint faz tentativa direta ao RSS e, se necessário, usa RSS2JSON como fallback. Como as fontes são serviços de terceiros, uma origem pode ficar fora do ar, alterar o XML ou limitar consultas. Se `items` estiver vazio, examine `sources[].error` antes de mudar o frontend.
- No site, a seção de notícias mostra um diagnóstico por fonte quando não recebe manchetes. O botão de atualizar aciona uma nova tentativa.

## KANDLE AI — ainda não lançada

O popup aparece na interface, mas só exibe a mensagem de desenvolvimento e não envia mensagens. Para lançar o chatbot depois, siga `AI-SETUP.md` integralmente: publicar o endpoint, configurar Workers AI, Durable Object e segredos, validar as cotas e somente então habilitar o recurso. A IA usa custos/franquias próprios do provedor, mesmo com uma interface gratuita.

## Dados e limitações

- Cripto: `https://data-api.binance.vision/api/v3` e streams públicos da Binance.
- Notícias: RSS de Google News/feeds cripto, com agregação em `/api/news`.
- Macroeconomia: widgets do TradingView. As referências OANDA/TVC podem diferir dos índices originais, conforme avisado na interface. O TradingView explica que o prefixo `TVC:` indica dados calculados pelo próprio TradingView e não deve ser comparado diretamente ao símbolo original.
- O painel é somente leitura e não envia ordens ou conecta carteiras.
- Dados financeiros e manchetes podem atrasar ou conter erros; consulte a fonte original e não use o dashboard como recomendação individual.
