# KANDLE v1.3 — notícias confiáveis, macro fallback e Liquid Glass

## Correções
- Adicionado `worker.js` para registrar `/api/news` no runtime Cloudflare Workers, compatível com o domínio `workers.dev` do projeto.
- Incluído `wrangler.jsonc` com assets estáticos e execução do Worker nas rotas `/api/*`, mais `/api/health` para diagnóstico. O Worker também encaminha `/api/ai` ao endpoint existente, que continua desligado por padrão.
- Mantida a mesma função de agregação exportada em `functions/api/news.js`, de forma que ela também possa ser usada como Pages Function.
- O agregador tenta cada RSS diretamente e usa RSS2JSON como fallback, incluindo erro detalhado por fonte e resposta diagnóstica mesmo se todas as origens falharem.
- O frontend mostra o diagnóstico das fontes, em vez de somente uma mensagem genérica, quando não recebe notícias.
- Nasdaq 100 passa a incorporar `OANDA:NAS100USD` como instrumento de referência e Dow Jones `TVC:DJI`; os links apontam aos símbolos originais. A UI explica que as fontes de referência não são idênticas aos índices oficiais.
- O breaking overlay força contenção horizontal e oculta a barra de rolagem que surgia com os flares/animações.
- A página Notícias é forçada como tela inicial, mesmo quando a URL foi salva anteriormente com `#page-markets` ou `#page-watchlist`.
- Aplicada a camada geral de vidro flutuante com reflexo de borda, backdrop blur/saturação, glow inferior e sombras de profundidade; refinadas também as bordas dos cartões.
- Favoritos preservam o bookmark único preenchido em verde.

## Verificações locais
- Sintaxe dos arquivos JavaScript.
- Mock do RSS para confirmar parser, normalização, URLs e payload JSON.
- Verificação de IDs HTML duplicados, páginas e símbolos de widgets.
- Integridade dos ZIPs de projeto e patch.

## Dependências externas ainda sujeitas a confirmação no deploy
O ambiente de criação não tem acesso externo à rede, então os feeds de produção e os widgets incorporados não puderam ser consultados ao vivo neste momento. Use `/api/health` e `/api/news` no domínio publicado para conferir a rota e o diagnóstico das fontes. O fallback OANDA/TVC está claramente identificado como instrumento de referência, não como o índice original.
