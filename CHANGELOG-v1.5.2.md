# KANDLE v1.5.2 — Notícias, tema e scroll

## Correções
- Widgets macro agora são recriados com `colorTheme`, `backgroundColor`, `widgetFontColor` e `fontColor` explícitos de acordo com o tema selecionado, evitando que permaneçam presos no tema escuro.
- A página de Notícias fica presa à área visível; apenas a lista de manchetes rola. Cabeçalho, filtros e radar ficam estáveis. No celular, o painel lateral é ocultado para dar espaço à lista.
- Atualizações automáticas preservam a posição de leitura da lista; ao trocar o filtro, a lista volta ao topo.
- Fontes editoriais separadas para política e economia do Brasil e do exterior, mantendo o grupo cripto separado. Os filtros Brasil, Cripto e Global agora abrangem seus respectivos feeds.
- Termos de eventos políticos de alto impacto foram adicionados ao detector de breaking news.
