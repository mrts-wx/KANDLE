# KANDLE — Market Intelligence

Dashboard responsivo de mercado com identidade visual neon: cotações cripto, candlesticks, notícias financeiras, breaking news e watchlist local. A função de IA aparece como popup retrato no canto inferior direito, mas no deploy atual mostra um aviso estático de desenvolvimento e **não faz chamadas de IA**.

## O que existe no projeto

- Cotações de BTC, ETH, SOL, BNB, XRP, DOGE, ADA e AVAX via API pública Binance Spot + WebSocket.
- Candles OHLCV com seleção de ativo e intervalos.
- Notícias financeiras consolidadas por uma Cloudflare Pages Function em `/api/news`, com feeds RSS de Google News e agregadores cripto, filtros temáticos e alerta visual de breaking news. A função roda no servidor para evitar bloqueios CORS do navegador e a dependência de um único proxy público.
- Lista de favoritos salva localmente no navegador.
- Widgets macro do TradingView.
- Layout adaptável a desktop, tablet e celular, foco de teclado e suporte à preferência por movimento reduzido.
- Popup KANDLE AI com mensagem “Em desenvolvimento, por favor aguarde até o lançamento da função para usá-la.”
- Endpoint `/api/ai` preparado para Workers AI, inicialmente bloqueado e dependente de variável explícita `KANDLE_AI_ENABLED=true`.
- Worker Durable Object separado para aplicar quotas globais e por endereço de rede de forma atômica.

## Estrutura

```text
.
├── index.html                 # interface principal
├── styles.css                 # visual, responsividade e animações
├── app.js                     # dados, candles, notícias e breaking news
├── ai.js                      # popup estático; NÃO chama IA
├── ai-chat.js                 # cliente de chat para usar só no lançamento
├── ai-launch/popup.html       # HTML do popup de chat futuro
├── functions/api/ai.js        # endpoint server-side do chat (off por padrão)
├── functions/api/news.js      # agregador RSS server-side (Cloudflare Pages Function)
├── quota-worker/              # Durable Object que aplica limites atômicos
├── AI-SETUP.md                # manual completo para ativar, testar e desligar a IA
└── MONETIZATION.md            # possibilidades de monetização e cuidados
```

## Rodar o dashboard localmente

Com Python instalado, execute na raiz:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`. Isso serve o frontend estático; o Cloudflare Pages Functions em `functions/` **não executa** nesse servidor simples. As chamadas em tempo real dependem da disponibilidade dos serviços externos.

Para executar Functions localmente, use a ferramenta da Cloudflare (`wrangler`) conforme o guia oficial e configure os bindings necessários. Não use Workers AI em desenvolvimento sem ter lido a página de preços/uso; inferência remota pode contar no consumo da conta.

## Deploy recomendado: Cloudflare Pages conectado ao GitHub

1. Faça push dos arquivos para um repositório.
2. Em Cloudflare, acesse **Workers & Pages → Create → Pages → Connect to Git** e selecione o repositório.
3. Configure preset **None**, sem build command, saída `.` e raiz contendo `index.html` e a pasta `functions/`.
4. Conclua o deploy. O site e a área popup de IA funcionam sem nenhuma chave ou binding de IA.
5. A rota `functions/api/news.js` será publicada como `/api/news` automaticamente, desde que a pasta `functions/` esteja na raiz do site. Não use só `python -m http.server` para validar a rota; esse servidor não executa Functions.
6. Para ativar o chatbot futuramente, siga **todo** o manual [`AI-SETUP.md`](AI-SETUP.md). Não ative `KANDLE_AI_ENABLED` antes de publicar/configurar o controlador de cotas e o binding AI.

## Controles e segurança da IA

A IA começa desabilitada: `functions/api/ai.js` retorna `503` quando `KANDLE_AI_ENABLED` não é exatamente `true`. Quando ativada, exige o binding de Workers AI, o Durable Object `AI_QUOTA` e o segredo `KANDLE_AI_QUOTA_SALT`. Os limites iniciais recomendados são 100 solicitações/dia global, 5/dia por IP e 3/minuto por IP; o Durable Object contabiliza os limites globais e individuais em transação. O modelo também tem os seus próprios limites/franquias do provedor. O guia explica o reset diário UTC, como testar quotas e como desligar a IA.

A identificação por IP é convertida em hash com salt antes do armazenamento; não é armazenado o IP em texto puro. Até existir autenticação, o limite “por usuário” é, na prática, por endereço de rede, então usuários na mesma rede compartilham cota. Para vender planos, implemente contas/autenticação, quotas por usuário e limites de abuso adicionais.

## Navegação e interface

- A página inicial é Notícias; a barra lateral troca entre Notícias, Mercados e Watchlist sem transformar a tela em uma página de rolagem longa.
- A camada de breaking news é global, independente da página que estiver aberta.
- O radar macro usa widgets TradingView isolados por ativo e os carrega só quando a página Mercados fica visível; um widget com falha não deve derrubar os demais. Links diretos para os instrumentos ficam disponíveis em cada card.
- Favoritos utilizam um único ícone de marcador Lucide com estado acessível e brilho verde; o marcador não troca por ícone de check.

## Dados, limitações e uso responsável

- Binance: `https://data-api.binance.vision/api/v3` e `wss://data-stream.binance.vision`.
- Notícias: `/api/news` tenta cinco feeds RSS em paralelo, consolida duplicatas e retorna o status de cada fonte. As fontes podem falhar, atrasar ou mudar a estrutura; o frontend mantém uma rota de contingência para preview local.
- Macro: widgets do TradingView.
- O dashboard é somente leitura; não envia ordens nem conecta carteiras.
- Notícias e IA podem conter erros, atrasos ou contexto incompleto. Consulte a fonte original. A KANDLE não garante retornos nem substitui aconselhamento financeiro individual.
- Antes de cobrar por relatórios ou sinais de ativos específicos, verifique as regras aplicáveis e os termos/licenças das fontes de dados.

## Documentação extra

- [`AI-SETUP.md`](AI-SETUP.md): manual completo para preparar, ativar, testar e desligar a IA.
- [`MONETIZATION.md`](MONETIZATION.md): possíveis modelos de receita e próximos passos.
