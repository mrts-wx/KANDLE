# KANDLE v1.6.0 — Neutral App Polish

## Melhorias
- Removido o botão público de teste de Breaking News e o caminho de alerta demonstrativo. Alertas reais continuam funcionando.
- Redesenho visual com paleta neutra, superfícies consistentes e contrastes legíveis nos temas claro e cinza-chumbo.
- Redução de brilhos, sombras, blur e transformações em hover para reduzir trabalho de renderização.
- Transições mais curtas e respeito a `prefers-reduced-motion`.
- Melhorias na usabilidade responsiva: cabeçalho mais compacto, filtros de notícias navegáveis em telas pequenas, melhor tipografia e controles com áreas de toque adequadas.
- Mantidos: Breaking Sound, alertas globais, páginas Notícias/Mercados/Watchlist, fontes RSS, gráficos e configuração Wrangler com assets em `public/`.
- Metadados de aplicação móvel adicionados sem service worker, para evitar cache de dados financeiros desatualizados.

## Observações de deploy
Substitua os arquivos da raiz do repositório pelos arquivos deste pacote e publique com o `wrangler.jsonc` existente. Os assets públicos continuam limitados a `./public`.

## Validação
Sintaxe dos scripts e integridade do pacote conferidas localmente; o deploy real e o desempenho em dispositivos finais precisam ser verificados após a publicação.
