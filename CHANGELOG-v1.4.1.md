# KANDLE v1.4.1 — Deploy fix + Breaking Sound

## Correção do deploy
- Corrige o erro `Asset too large` do Cloudflare Workers.
- Os assets públicos do site ficam exclusivamente em `public/`.
- `wrangler.jsonc` define `assets.directory` como `./public`, para impedir que `node_modules/` (incluindo `workerd`) seja empacotado como asset estático.
- O código do Worker, as funções de API, a documentação e as configurações ficam fora do diretório público.

## Mantido nesta versão
- Vinheta original KANDLE Breaking Sound sintetizada pela Web Audio API.
- Controle de som no topo, preferência salva e prévia ao ativar.
- Breaking News global com som condicionado à preferência e às permissões de áudio do navegador.
- Design Liquid Glass, navegação em páginas, favoritos, cotações/candles e widgets macro.
- Endpoint de notícias no Worker e diagnóstico por `/api/health` e `/api/news`.
- Popup KANDLE AI ainda em modo de desenvolvimento.

## Deploy
Use o `wrangler.jsonc` incluído. Não configure o repositório inteiro como pasta pública. A pasta de assets é `./public`.
