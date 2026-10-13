# Operação do Radar Consórcios

Este guia reúne os controles de execução. Para entender a finalidade e as decisões editoriais, comece pelo [README principal](../README.md). Não registre neste arquivo senha, número de telefone, ID de grupo ou conteúdo da sessão.

## Agenda e destinos

| Rotina | Agenda solicitada | Observação |
| --- | --- | --- |
| Coleta e eventuais alertas | A cada 2 horas, minuto 17, em `America/Sao_Paulo`. | GitHub Actions é de melhor esforço; pode atrasar ou pular um disparo. |
| Saúde da sessão | Mesmo sem notícia nova, ao menos uma verificação diária quando o envio está ativo. | Uma execução verde sem candidato não prova, sozinha, que a sessão está conectada. |
| Resumo semanal | Sábado às 9h; retentativa às 12h só se ainda não houve confirmação. | Pode usar `WHATSAPP_WEEKLY_GROUP_ID`; caso contrário, usa o grupo principal. |
| Painel público | Após push em `main` ou persistência de dados pelos workflows. | O navegador aberto verifica `version.json` a cada 5 minutos. |

As definições executáveis estão em [radar.yml](../.github/workflows/radar.yml), [weekly.yml](../.github/workflows/weekly.yml), [publish-dashboard.yml](../.github/workflows/publish-dashboard.yml) e [config/default.json](../config/default.json). Se este texto divergir deles, a configuração executável prevalece.

## Pausar sem remover o histórico

Em **Settings → Secrets and variables → Actions → Variables**, defina `SEND_ENABLED=false`. Isso pausa o envio programado, mas não apaga a base nem o histórico. Antes de uma execução manual do workflow, confira o campo `send_enabled`: o padrão é **false**. Não troque o grupo de destino sem validar o ID e o objetivo da mudança.

## Segredos e variáveis

| Tipo | Nome | Função |
| --- | --- | --- |
| Secret | `BOT_STATE_PASSWORD` | Cifra e decifra a sessão vinculada. |
| Secret | `WHATSAPP_GROUP_ID` | Grupo de alertas. |
| Secret opcional | `WHATSAPP_WEEKLY_GROUP_ID` | Grupo do resumo semanal, se for diferente. |
| Secret opcional | `DEEPSEEK_API_KEY` | Segunda leitura por IA quando habilitada. |
| Variable | `SEND_ENABLED` | `true` permite envio programado; `false` pausa. |
| Variable | `AI_REVIEW_ENABLED` | Controla a revisão por IA sem alterar o código. |

Nunca inclua a sessão aberta, senha, IDs de grupos ou arquivos `.local/` no Git. O workflow persiste somente a sessão cifrada em `state/auth.enc` e seu hash.

## Validar antes de enviar

```sh
npm ci
npm run check
npm test
npm run dashboard:build:public
node scripts/check-public-dashboard.mjs
```

No workflow manual **Radar de Consórcios**, deixe `send_enabled=false` para testar a coleta e gerar uma prévia sem mensagem. A opção `ai_preview=true` testa também a revisão por IA na prévia, quando a chave estiver configurada. Uma prévia manual sem persistência não atualiza automaticamente a base ou o Pages.

Para acompanhar a execução real, examine as etapas do Actions e os artefatos da rodada, sobretudo saúde das fontes, funil de classificação e auditoria da revisão por IA. Falha parcial de uma fonte não impede necessariamente a coleta pelas demais.

## Atualizar a base e o painel local

```sh
npm run catalog:update
npm run dashboard:build
npm run dashboard:serve
```

O painel local abre em `http://127.0.0.1:4173/` e pode conter texto integral para auditoria. O pacote público é gerado separadamente e validado antes do deploy. Revisões editoriais devem guardar motivo e trecho de evidência, ser lacradas por `npm run reviews:seal` e passar pelos testes antes de `catalog:update`. O [guia da base](../data/catalogo/README.md) explica os campos e o desdobramento de PDFs em atos.

## Se o WhatsApp desvincular

Pare os envios (`SEND_ENABLED=false`), faça novo pareamento local com `npm run pair`, prepare a sessão cifrada com `npm run session:prepare` e atualize apenas os arquivos cifrados necessários. Reative os envios somente após `npm run session:check` reconhecer o grupo correto. O histórico de publicações e deduplicação permanece em `state/news-state.json`.

Baileys usa WhatsApp Web e não é uma API oficial da Meta; reconexão e confirmação de entrega têm limites práticos. Uma execução bem-sucedida do Actions não deve ser interpretada como garantia absoluta de entrega de cada mensagem.
