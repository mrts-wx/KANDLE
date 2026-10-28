# KANDLE AI — manual de lançamento (Cloudflare Pages + Workers AI)

Este arquivo é o passo a passo para lançar o chatbot quando você decidir. **No deploy atual, a IA fica desligada por padrão e a interface mostra apenas “Em desenvolvimento, por favor aguarde até o lançamento da função para usá-la.”** A página não chama o endpoint e não consome créditos enquanto estiver assim.

## Resumo da arquitetura

- **Interface atual:** `ai.js` abre/fecha somente o popup de aviso. Não tem campo de mensagem nem faz pedidos à IA.
- **Interface futura:** `ai-launch/popup.html` contém o HTML do chat e `ai-chat.js` contém o cliente preparado para chamar `/api/ai`.
- **Endpoint:** `functions/api/ai.js` é a porta de entrada. Por padrão, recusa qualquer chamada se `KANDLE_AI_ENABLED` não for exatamente `true`.
- **Modelo:** Cloudflare Workers AI por binding `AI`; não precisa inserir chave da OpenAI ou token de API no navegador. O modelo inicial é `@cf/meta/llama-3.1-8b-instruct-fp8`. Consulte o catálogo/preços atuais antes de alterar.
- **Cotas:** `quota-worker/` contém um Worker separado com Durable Object. O armazenamento transacional mantém as cotas globais e por endereço de rede consistentes mesmo com várias instâncias do site.

## Antes de começar

1. Tenha uma conta Cloudflare e o site publicado em **Workers & Pages → Pages**.
2. Instale Node.js LTS, que inclui o npm.
3. Mantenha o repositório privado enquanto desenvolve; mesmo assim, nunca comite segredos. Um repositório privado não é um cofre de chaves.

## Parte A — publicar primeiro o site (IA ainda desligada)

1. Envie os arquivos do projeto ao GitHub.
2. Na Cloudflare, vá para **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
3. Use preset **None**, sem build command e diretório de saída `.`. A pasta `functions/` precisa ficar na raiz junto de `index.html`.
4. Conclua o deploy.
5. Não defina `KANDLE_AI_ENABLED=true`. Se a variável nem existir, o endpoint também ficará desligado.

O frontend atual já exibe o popup de desenvolvimento. Não precisa configurar Workers AI para publicar a página.

## Parte B — criar o controlador de cotas (Durable Object)

Esse componente conta as chamadas de forma compartilhada e atômica. Sem ele, o endpoint bloqueia chamadas para evitar consumo sem controle.

1. Abra um terminal na raiz do projeto. Confirme que o Node.js está instalado com `node --version`.
2. Faça login na Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Publique o Worker de cotas:

   ```bash
   npx wrangler deploy --config quota-worker/wrangler.jsonc
   ```

4. No dashboard Cloudflare, abra **Workers & Pages → seu projeto Pages → Settings → Bindings → Add → Durable Object**.
5. Crie um binding com o nome/variável **`AI_QUOTA`** e escolha o namespace **`KandleQuota`** do Worker **`kandle-ai-quota`**.
6. Salve e faça novo deploy do projeto Pages para aplicar o binding.

A URL pública do Worker de cotas não oferece uma rota para reservar cotas: as reservas são feitas pelo binding a partir da Function. O endpoint público do Worker responde 404.

## Parte C — ligar o Workers AI

1. Abra **Workers & Pages → seu projeto Pages → Settings → Bindings → Add → Workers AI** (a posição exata do menu pode mudar).
2. Defina o nome/variável do binding como **`AI`** e salve.
3. Confira na documentação/catalogo da Cloudflare que o modelo `@cf/meta/llama-3.1-8b-instruct-fp8` continua disponível para sua conta. Se trocar de modelo, atualize a variável abaixo.

Workers AI tem uma franquia diária gratuita documentada de 10.000 Neurons por dia; o consumo real por pergunta varia conforme o modelo e o tamanho de entrada/saída. Acima da franquia, os limites/comportamento dependem do plano Cloudflare. Não trate “gratuito” como ilimitado. Consulte sempre a página de preços: https://developers.cloudflare.com/workers-ai/platform/pricing/

## Parte D — criar os segredos e limites

Em **Pages → Settings → Variables and Secrets**, crie as variáveis abaixo. Não deixe segredo dentro do código, do HTML, do arquivo `.env` comitado ou de variáveis públicas do frontend.

| Nome | Tipo | Valor recomendado inicial | Para que serve |
| --- | --- | --- | --- |
| `KANDLE_AI_ENABLED` | texto | `false` até concluir os testes; depois `true` | Interruptor mestre do backend |
| `KANDLE_AI_MODEL` | texto | `@cf/meta/llama-3.1-8b-instruct-fp8` | Modelo servido pela Cloudflare |
| `KANDLE_AI_GLOBAL_DAILY_LIMIT` | texto | `100` | Máximo de reservas de perguntas aceitas pela KANDLE por dia, somando todos os visitantes |
| `KANDLE_AI_USER_DAILY_LIMIT` | texto | `5` | Máximo diário por endereço de rede (IP), enquanto não houver contas |
| `KANDLE_AI_IP_PER_MINUTE_LIMIT` | texto | `3` | Limite por minuto para evitar rajadas |
| `KANDLE_AI_QUOTA_SALT` | **Secret** | sequência aleatória de pelo menos 32 caracteres | Protege o hash do IP que a cota guarda |

Para criar um segredo aleatório localmente, use um gerador de senhas confiável ou gere um valor longo no terminal. Cadastre-o como **Secret** e nunca envie o valor no chat, em issues, em prints ou para o GitHub.

O sistema não armazena o endereço IP em texto puro; gera um hash com salt antes de usar a chave de quota. Ainda assim, esse identificador é pseudônimo e deve ser tratado com cuidado, conforme a política de privacidade do site. Cotas por IP não equivalem a cotas por conta: pessoas atrás da mesma rede compartilham o limite, e uma VPN pode alterar o endereço. Para cobrar assinaturas no futuro, adicione autenticação e cotas por usuário autenticado.

### Como os limites se comportam

- **100/dia global:** ao chegar a 100 reservas, qualquer pessoa recebe HTTP 429 até a renovação da cota.
- **5/dia por IP:** evita que um visitante consuma toda a franquia. O usuário vê uma mensagem de cota diária atingida.
- **3/minuto por IP:** evita rajadas automatizadas.
- **Reset:** as cotas globais e diárias usam UTC, que corresponde a 21h do dia anterior em São Paulo (UTC−3). O contador volta a zero quando começa o novo dia UTC.
- **Contagem conservadora:** uma reserva é contada antes de chamar o modelo, portanto uma falha no provedor também pode consumir uma tentativa. Isso evita que falhas sejam usadas para contornar o limite.
- **Cota extra Cloudflare:** além dos limites da KANDLE, o próprio Workers AI pode limitar ou cobrar uso conforme a conta e o plano.
- **Fail closed:** se o controlador de cotas estiver sem configuração/indisponível, o endpoint não chama o modelo.

Os limites podem ser reduzidos a qualquer momento pelo dashboard. Para lançar a um público maior, comece com valores baixos e observe o consumo real antes de aumentar.

## Parte E — ativar a interface de chat (só no lançamento)

O popup atual é propositalmente um aviso estático. Para transformá-lo no chatbot:

1. Abra `index.html`.
2. Localize os comentários `KANDLE AI POPUP START` e `KANDLE AI POPUP END`.
3. Substitua **todo o bloco entre esses comentários** pelo conteúdo do arquivo `ai-launch/popup.html`.
4. No final de `index.html`, troque `<script src="ai.js"></script>` por `<script src="ai-chat.js"></script>`. Não carregue os dois ao mesmo tempo.
5. Faça commit e push para o GitHub; espere o deploy automático terminar.
6. Teste com `KANDLE_AI_ENABLED=false` primeiro (o endpoint precisa devolver `503` e `code: AI_DISABLED`). Só depois de verificar todos os bindings e limites, troque para `true` e publique novamente.

> **Importante:** não basta ativar a variável do backend para liberar o chat — é preciso publicar também a interface de chat da parte E. E não basta publicar a interface: o backend continuará bloqueado até `KANDLE_AI_ENABLED=true`.

## Parte F — testes de lançamento

Faça estes testes antes de divulgar a URL:

1. **Estado desligado:** com variável `false`/ausente, `GET /api/ai` deve retornar `enabled: false`; uma requisição POST deve retornar 503 com `AI_DISABLED`.
2. **Binding ausente:** com flag `true` sem binding `AI`, deve retornar 503 sem tentar gerar resposta.
3. **Cota:** use temporariamente `KANDLE_AI_GLOBAL_DAILY_LIMIT=2`, faça duas perguntas e confirme que uma terceira retorna 429. Depois restaure um limite apropriado e faça novo deploy.
4. **Limite por rede:** use `KANDLE_AI_USER_DAILY_LIMIT=1`, teste duas perguntas pela mesma conexão, confirme 429 e depois restaure o valor.
5. **Privacidade:** confirme que a tela não expõe tokens/segredos e que os logs não registram mensagem completa, chave de API ou IP em texto puro.
6. **Celular:** teste abrir/fechar o popup, botão Esc no desktop, scroll e o teclado virtual.
7. **Custos:** confira o uso no painel Workers AI após os testes.

Não faça loops de teste nem publique limites elevados apenas para testar. As tentativas aceitas contam na quota diária.

## Voltar a desligar imediatamente

1. Abra Pages → Settings → Variables and Secrets.
2. Mude `KANDLE_AI_ENABLED` para `false` ou remova a variável.
3. Salve e faça um novo deploy se solicitado.

O endpoint fecha antes de chamar o modelo. Para remover a interface de chat também, restaure o popup atual do `index.html` e o `ai.js` minimalista.

## Links oficiais

- Workers AI — início: https://developers.cloudflare.com/workers-ai/get-started/
- Workers AI — binding em Pages Functions: https://developers.cloudflare.com/workers-ai/configuration/bindings/
- Workers AI — preços e franquia: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Pages Functions — bindings, incluindo Durable Objects: https://developers.cloudflare.com/pages/functions/bindings/
- Wrangler — CLI: https://developers.cloudflare.com/workers/wrangler/

