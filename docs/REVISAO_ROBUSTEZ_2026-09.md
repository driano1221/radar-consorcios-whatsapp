# Revisão de robustez do pipeline (24/09/2026)

Revisão feita depois da conta do GitHub ser sinalizada em 23/09/2026 e o radar ficar parado por um dia. Cobre os workflows, o fluxo de `src/radar.mjs`, a integração com o WhatsApp e o histórico de execuções.

## Como estava

O pipeline já tem boa parte do que se espera de um coletor robusto: cada fonte roda isolada (`Promise.allSettled`), uma fonte fora do ar não derruba as outras, há deduplicação e fila de pendentes, o estado é salvo a cada mensagem enviada, o envio é suspenso se a chave da IA faltar, os 73 testes de regressão rodam antes de cada coleta e falhas persistentes abrem alerta. Nas execuções de 24/09, todas passaram; a coleta trouxe cerca de 150 itens, 15 relevantes, e a revisão por IA rejeitou corretamente dois atos administrativos (extinção de contrato e ordem cronológica de pagamento).

## O que já foi mudado

- **Agendamento de 15 minutos para 2 horas.** O GitHub já pulava a maioria dos disparos (na prática eram de 4 a 6 coletas por dia), e agendamento muito frequente é tratado como padrão de abuso. A trava de 50 minutos contra coletas repetidas continua.

## Recomendações, por prioridade

### 1. Sessão do WhatsApp em máquinas do GitHub

É o maior risco. As falhas de 12 a 14/09 foram a sessão desconectada pelo WhatsApp, o que exigiu parear de novo. Cada execução do Actions sai de um IP de datacenter diferente, e o WhatsApp usa a reputação do IP para detectar automação ([issue 1976 do Baileys](https://github.com/WhiskeySockets/Baileys/issues/1976), [issue 1895](https://github.com/WhiskeySockets/Baileys/issues/1895)).

O código já reduz o risco ao conectar só quando há mensagem para enviar e uma vez por dia na checagem de saúde. Se as quedas voltarem, a solução estrutural é separar as funções: o Actions continua coletando e classificando, e o envio passa para uma máquina fixa (um computador em casa ou um serviço com IP estável) que lê a fila e mantém uma única sessão aberta. A API oficial do WhatsApp aceita grupos desde 2025, mas exige conta comercial oficial e limita o grupo a 8 participantes ([Meta, Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups)), então não serve para este caso.

### 2. Prévia que não mostra a decisão da IA

No disparo manual sem envio, a revisão por IA não roda, então a prévia pode listar itens que a IA depois rejeitaria (aconteceu em 24/09: a prévia mostrou 2 selecionados e o envio real, 0). Sugestão: uma opção `ai_preview` no disparo manual que roda a revisão sem enviar e sem salvar estado. O custo é baixo (cerca de 1.000 tokens por item).

### 3. Versão do Baileys

A versão fixada (6.7.24) passou a ser marcada como `legacy`; a série 7.0 ainda está em release candidate. Não migrar para uma versão candidata; quando a 7.0 sair estável, testar num branch com a checagem de sessão antes de levar para a `main`.

### 4. Estado versionado no Git

`state/news-state.json` tem cerca de 2,6 MB e é commitado a cada execução com envio. O repositório tem 10 MB hoje, o que é tranquilo, mas vale acompanhar. Se crescer demais, a poda do estado pode ficar mais agressiva nas observações antigas ou o histórico pode ir para os artefatos de cada execução.

### 5. Querido Diário

A API oscila (503 e timeouts). O radar já repete a janela de sete dias e marca a fonte como degradada, então os itens voltam na coleta seguinte. Nada a fazer além de acompanhar a saúde da fonte.

## O que não é problema

- Os erros "Bad MAC" e "MessageCounterError" no log da checagem de sessão vêm da biblioteca de criptografia ao ler mensagens antigas; a checagem termina com "Sessão válida".
- A consulta da versão do WhatsApp Web já tem fallback dentro do Baileys (se falhar, usa a versão embutida).
