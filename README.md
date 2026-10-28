# KANDLE — Market Intelligence

Terminal responsivo para acompanhar criptoativos, candles, notícias financeiras, breaking news e uma watchlist. A v1.5 prioriza **fluidez, legibilidade e aparência de web app**, com tema Branco/Porcelana e tema Cinza-Chumbo selecionáveis, superfícies glass leves, navegação separada por páginas e a vinheta original do Breaking News. A KANDLE AI continua em modo de aviso de lançamento e não faz chamadas de inferência.

## Correção importante de deploy — `Asset too large`

Esta versão **inclui também o KANDLE Breaking Sound da v1.4** e corrige o erro do Cloudflare Workers que aparecia assim:

```text
Asset too large
.../node_modules/workerd/bin/workerd (137 MiB)
```

O problema era configurar a raiz do repositório (`.`) como pasta de assets estáticos. Em builds, o `npm install` cria `node_modules/`, e o Wrangler tentava publicar o executável `workerd` como se fosse um arquivo público do site.

**Agora, somente a pasta `public/` é publicada como asset estático.** O código do Worker e do servidor fica fora dela.

## Estrutura

```text
.
├── public/
│   ├── index.html       # interface do site
│   ├── styles.css       # temas, superfícies glass leves, contraste e responsividade
│   ├── app.js           # cotações, candles, navegação e breaking news
│   ├── ai.js            # popup de IA em modo de desenvolvimento
│   └── 404.html         # página de não encontrado
├── worker.js            # roteia APIs e serve env.ASSETS
├── wrangler.jsonc       # assets.directory = ./public
├── package.json         # scripts para Wrangler
├── functions/api/       # endpoints de notícias e IA
├── quota-worker/        # código de cotas para lançamento futuro da IA
├── AI-SETUP.md          # guia futuro da IA
└── MONETIZATION.md      # plano de monetização
```

## Deploy pelo GitHub + Cloudflare Workers Builds

1. Extraia este ZIP.
2. Substitua os arquivos do repositório pela estrutura deste pacote. **Importante:** mantenha a pasta `public/` na raiz do repositório e envie todos os arquivos de configuração. Não coloque `node_modules/` no Git.
3. No painel Cloudflare, abra o Worker ligado ao GitHub e confirme que o deploy usa o `wrangler.jsonc` da raiz do repositório.
4. Use o comando de deploy configurado no seu fluxo (por exemplo, `npm run deploy`). O Wrangler lerá `assets.directory: "./public"` e só enviará essa pasta como assets do site.
5. Não configure a raiz inteira do repositório como diretório de assets no painel. A raiz contém código do Worker, funções, arquivos de documentação e pode conter `node_modules/` durante o build.
6. Após o deploy, valide as rotas abaixo.

Se o painel tiver um campo manual de diretório de assets substituindo a configuração Wrangler, remova essa substituição e faça o Wrangler usar o `wrangler.jsonc` do repositório.

## Deploy local

Requer Node.js instalado e login na Cloudflare:

```bash
npm install
npx wrangler login
npm run dev
```

Teste:

- `http://localhost:8787/api/health` — esperado: JSON com `ok: true`.
- `http://localhost:8787/api/news` — JSON de notícias e diagnóstico individual das fontes.
- `http://localhost:8787/` — interface KANDLE.

Para publicar localmente:

```bash
npm run deploy
```

O nome configurado do Worker é `kandle`. Altere `name` em `wrangler.jsonc` caso seu Worker tenha outro nome.

## Diagnóstico de notícias

- `GET /api/health`: confirma que o Worker responde.
- `GET /api/news`: retorna `items`, `sources`, `updatedAt` e `partial`; fontes individuais informam `ok`, `count` e erro quando houver.
- A agregação RSS acontece no servidor. Feeds de terceiros podem limitar, mudar o XML ou ficar fora do ar. Se não houver manchetes, veja `sources[].error` antes de alterar o frontend.

## Funcionalidades incluídas

- Cotações públicas e candles de cripto via Binance Spot/streams públicos.
- Notícias agregadas por servidor, com status por fonte.
- Breaking News global com vinheta original criada via Web Audio API; o som não reproduz a assinatura sonora da CNN.
- Preferência de som salva no navegador e teste de alerta.
- Temas Branco/Porcelana e Cinza-Chumbo, com preferência salva e gráficos adaptados ao tema.
- Renderização dos ticks agrupada em lotes, sem reflow síncrono forçado, com menos mutações e animações contínuas para melhorar a fluidez.
- Páginas independentes Notícias (inicial), Mercados e Watchlist.
- Favoritos com bookmark preenchido em verde neon.
- Widgets TradingView; referências alternativas para Nasdaq/Dow podem divergir dos símbolos oficiais, conforme indicado na interface.
- IA ainda desativada. Consulte `AI-SETUP.md` para planejar o lançamento futuro.

## Se o deploy ainda falhar

Confirme que o erro novo não está apontando para `node_modules/workerd`. No `wrangler.jsonc`, o diretório precisa ser exatamente `./public`. Verifique também se a pasta `public/` aparece no commit do GitHub. Não adicione `node_modules` à pasta `public`.

## Limitações

Cotações, feeds e widgets dependem de serviços externos e podem sofrer indisponibilidade. O painel é informativo; ele não envia ordens nem conecta carteiras e não é recomendação financeira individual.


## KANDLE v1.5 — Fluid App

- Tema alternável entre **Branco** e **Cinza-chumbo** pelo botão de sol/lua no topo; a preferência fica salva no navegador.
- Otimização de fluidez: cotações via WebSocket são agrupadas antes de atualizar a interface, retirado o reflow forçado dos flashes de preço, Market Pulse só redesenha quando a direção dos ativos muda e o gráfico fallback calcula o volume máximo apenas uma vez por desenho.
- Liquid Glass mais leve: superfícies opacas/translúcidas com bordas refletivas e sombras mais discretas; removidos blur e glow contínuos caros e reduzidas animações permanentes.
- Cores do gráfico e widgets TradingView acompanham o tema selecionado.
- Respeito a `prefers-reduced-motion`. O KANDLE Breaking Sound, o Worker e os arquivos de deploy foram mantidos.

O deploy continua seguindo `wrangler.jsonc`: os arquivos estáticos devem ser servidos exclusivamente pela pasta `public/`.
