# KANDLE v1.5.1 — TradingView Theme Fix

- Corrigidos widgets macro (S&P 500, Nasdaq 100, Ibovespa e Dow Jones) que permaneciam com fundo claro no tema cinza-chumbo.
- Definido esquema de cores explícito para o widget incorporado: `colorTheme`, `backgroundColor`, cores de texto e linha.
- Widgets reconstruídos na troca de tema para garantir nova configuração no iframe do TradingView.
- Ajustado o ciclo de vida dos timers para impedir fallback atrasado de uma geração anterior do widget.
- Preservados os candles de cripto, temas, Break Sound, Worker e configuração segura de assets.
