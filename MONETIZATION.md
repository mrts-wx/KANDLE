# Plano de monetização para a KANDLE

A recomendação é lançar como **freemium**, provar que as pessoas voltam ao terminal e só então colocar recursos avançados atrás de uma assinatura. Não comece cobrando por uma promessa de “prever o mercado”: a proposta forte da KANDLE é economizar tempo, organizar contexto e deixar o usuário acompanhar o que importa.

## Fase 1 — crescer sem piorar a experiência

- **Plano grátis:** cotações ao vivo, candles, manchetes, favoritos e uma quota pequena de perguntas da KANDLE AI.
- **Lista de espera / newsletter:** resumo semanal de novidades do produto, sem transformar e-mail em spam.
- **Links de afiliado:** corretoras, ferramentas e provedores de dados que realmente façam sentido. Identifique claramente que o link é afiliado e compare riscos/condições sem esconder conflito comercial.
- **Patrocínios identificados:** espaços limitados para marcas relevantes. Nunca misture conteúdo pago com uma manchete editorial sem rotulagem.
- **Publicidade:** avaliar depois de ter tráfego recorrente. Evite anúncios intrusivos cobrindo candles ou o breaking-news.

## Fase 2 — KANDLE Plus

Teste um preço inicial de **R$ 19,90–29,90 por mês** como hipótese comercial, não como “preço de mercado” validado. Compare conversão, cancelamento e custo variável. Recursos possíveis:

- alertas configuráveis por preço, variação percentual e volume;
- múltiplas watchlists, filtros salvos e layouts personalizados;
- mais perguntas à IA com quota explícita;
- resumo diário de manchetes e calendário de eventos macro;
- exportação de histórico/relatórios e histórico de alertas;
- sem anúncios ou com um layout mais limpo.

## Fase 3 — Pro / B2B

Após medir uso real, teste uma faixa superior, por exemplo **R$ 39,90–79,90 por mês**, para mais ativos, alertas avançados, fluxos de notícias especializados, integrações, exportações e recursos de equipe. Outra rota é vender um widget/API de manchetes e métricas para sites, comunidades e criadores, com contrato, limites técnicos e licenças das fontes claramente resolvidos.

Não implemente todos os recursos de uma vez. Um teste simples é medir quantos usuários ativos usam um alerta ou a IA várias vezes por semana e quantos pagariam por isso.

## Economia unitária: cuide do custo da IA

1. Mantenha o modelo e o máximo de tokens configuráveis; a Function já limita o tamanho do prompt e da resposta.
2. Defina limites por dia/mês e exiba a quota ao usuário antes de acabar.
3. Não permita que um visitante anônimo faça milhares de chamadas: o rate limit inicial no código é best-effort. Antes de abrir ao público, acrescente proteção de rate limit global no Cloudflare e autenticação/quota por conta.
4. Monitore custo por usuário ativo, custo por resposta, receita líquida após taxas de pagamento, chargebacks e cancelamentos.
5. Não confie apenas no limite de uso do front-end; todos os limites precisam ser verificados no backend.

## Cuidados regulatórios no Brasil

A linha de risco muda quando o produto deixa de explicar dados em geral e passa a publicar com habitualidade análises profissionais e recomendações sobre valores mobiliários específicos, especialmente cobrando assinatura, mensalidade ou obtendo remuneração indireta. A CVM destaca que a prática profissional e a remuneração podem ser relevantes e que um simples aviso “não é recomendação” não resolve automaticamente o enquadramento. Antes de vender relatórios/alertas que recomendem operações específicas, consulte advogado regulatório e, se necessário, profissional credenciado.

Para um primeiro produto mais seguro, foque em ferramentas, dados, comparações factuais, explicação educacional de notícias e alertas definidos pelo próprio usuário — sem personalizar recomendação, prometer retorno ou incentivar manipulação. Isso não substitui análise jurídica. Verifique também licenças e termos dos provedores de dados, anúncios identificados, política de privacidade/LGPD, termos de uso, cancelamento e notas fiscais.

## Métricas que realmente importam

- usuários ativos semanais e retenção em 4 semanas;
- alertas configurados por usuário e taxa de abertura;
- perguntas à IA por usuário e custo de IA por usuário;
- conversão do grátis para o pago e cancelamento mensal;
- margem depois de API, hospedagem, pagamentos, impostos e suporte.

**Estratégia sugerida:** primeiro lançar gratuitamente e validar retenção; depois cobrar por limites, personalização e automação — não por uma promessa de “acertar a próxima alta”.
