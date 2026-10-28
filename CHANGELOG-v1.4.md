# KANDLE v1.4 — Breaking News com vinheta sonora

## Adicionado
- Vinheta sonora original sintetizada com Web Audio API: impacto grave curto e sequência ascendente de tons com estética de transmissão urgente.
- Botão de alto-falante no topo com estados ativado/desativado, atributos acessíveis e preferência persistida no navegador.
- O botão de som reproduz uma prévia quando ativado, facilitando o teste de volume e compatibilidade.
- A vinheta toca ao abrir um breaking news real ou de demonstração, quando o som está ativado e o navegador liberou o áudio.

## Compatibilidade e privacidade
- Não é usada nem distribuída gravação da CNN; o tema sonoro é original.
- Não há arquivo de áudio externo, nova dependência ou chamada de rede para som.
- Autoplay pode ser bloqueado pelo navegador até a primeira interação do utilizador; os alertas visuais continuam funcionando sem áudio.
- A preferência de som fica no `localStorage` do próprio navegador.

## Arquivos alterados
- `app.js`
- `index.html`
- `styles.css`
- `README.md`
