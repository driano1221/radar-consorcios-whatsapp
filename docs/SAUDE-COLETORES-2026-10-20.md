# Saúde dos coletores — 20/10/2026

## Diagnóstico e limites

A rodada de produção `39506978934` leu 338 itens e registrou três envios. Seus avisos de saúde tinham causas diferentes:

- **Querido Diário:** API principal e proxies responderam 503. Nova leitura de `https://api.queridodiario.org.br/health` confirmou `503 no available server`. O incidente continua aberto na [issue oficial #113](https://github.com/okfn-brasil/querido-diario-api/issues/113). O endereço atual já estava corrigido; recuperar esse servidor depende do provedor. Os conectores diretos de MG, AL, PR, RN e SC continuam independentes da API e não equivalem a cobertura nacional.
- **MG, PR e RN:** 50 matérias por portal, todas com íntegra, e mais páginas disponíveis. O limite de duas páginas era corretamente mostrado como cobertura parcial, mas também incrementava `consecutiveFailures` e produzia alertas de falha de acesso indevidos.
- **Páginas originais:** três recusas HTTP 403 (Araguaia Notícia, Portal da Cidade/Casa Branca e Alto Paraopeba). As duas últimas foram reproduzidas localmente com página de desafio. Os itens sem íntegra continuam sem autorização automática para envio; reproduções de outros editores não são rotuladas como originais recuperados.

## Alterações

1. MG, PR e RN passam a até quatro páginas/100 leituras por rodada. O orçamento de 90 segundos por portal, espaçamento compartilhado, validação de código/data e cache com hash são preservados. AL mantém duas páginas. MG/PR ainda têm mais resultados do que esse limite e continuam explicitamente parciais.
2. `direct-gazettes.mjs` marca `limited:true` somente quando a única lacuna é a paginação e todas as matérias examinadas têm íntegra, sem erro de rede. O agregado dos scrapers conserva essa distinção. `observeRun` mantém `status:degraded`, mas não conta essa amostra acessível como falha consecutiva. Erro numa página posterior ou numa íntegra continua falha.
3. O cliente QD interrompe consultas restantes quando todas as rotas testadas indicam 503 ou falha de conexão de origem 521/522/523, independentemente da redação do HTML de erro. Retenta no próximo agendamento. Erros 502/504/520/524 de uma busca não bastam para suspender as outras consultas. A indisponibilidade total do coletor passa a ser `error` no agregado, preservando a perda de cobertura visível.
4. A revisão paga opcional do workflow `validate-direct-gazettes.yml` passa a exigir `review_ai:true`; o padrão é falso. A validação desta manutenção mantém envio, persistência e IA desligados, sem sessão ou grupo nos secrets do job. Limites de IA e agendas de produção não foram ampliados.

Exemplo: antes, MG lia 50 íntegras e somava uma falha por haver página 3. Agora pode ler 100, registra cobertura parcial e contador de falha zero. Se a página 2 responder 503, o contador aumenta e a lacuna permanece descrita. Isso não declara as páginas restantes examinadas.

## Verificação

- Regressões falharam antes da correção: limite puro, extração recusada, erro na segunda página, propagação no agregado, contador de saúde e indisponibilidade QD. Um caso adicional protege consultas válidas após erro de gateway em outra busca.
- A suíte local completa passou em 482 testes; após o ajuste final do QD, os 14 testes focados também passaram. A versão final é exercitada novamente no workflow dedicado.
- Leitura real local: **361 documentos**, **360 íntegras**, uma prévia histórica RNCP sem texto suficiente. MG 100/100; AL 15/15; PR 100/100; RN 56/56, encerrando as três páginas disponíveis; SC 85/85. Nenhum erro de leitura nos quatro portais SIGPub; MG/PR continuam com mais páginas.
- Fotografias antes/depois preservaram **2.522 documentos, 416 revisões**, IDs, atos, provas lacradas, fila, recibos e sessão. `git diff HEAD -- data state` permaneceu vazio. Os dados da amostra não foram importados nem enfileirados.
- Reproduzir: `npm run check`, `npm test`; para leitura real, executar `validate-direct-gazettes.yml` com `review_ai:false`. As evidências ficam no artefato `direct-gazettes-<run>` e nos relatórios `source-health.json`/`article-enrichment-audit.json` da simulação. Não disparar workflow de envio para validar esta correção.

**Validação final no GitHub:** [39512292145](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/39512292145), código `b42de24`, aprovada às **20h04 de Brasília**, com **483/483 testes**, zero ignorados. A leitura dos diários diretos encontrou **356 documentos e 356 íntegras**: MG 100, AL 15, PR 100, RN 56 e SC 85. O RNCP ficou explicitamente bloqueado por 403 no runner e continua desativado em produção; os cinco documentos históricos examinados localmente não entraram nessa contagem do GitHub.

A simulação geral coletou **445 itens**, um candidato novo selecionado em prévia, **sem enfileirar, enviar ou persistir**. O indicador `3/72 enviados hoje` do resumo era o histórico anterior à validação, não três envios novos. A etapa opcional de IA foi `skipped`; o job não restaurou sessão e não recebeu secrets de grupo/autenticação WhatsApp. A conferência final aprovou a preservação de 2.522 documentos, 416 revisões, provas, fila, recibos e sessão. O artefato `direct-gazettes-39512292145` preserva os relatórios.

Na simulação do GitHub, MG/PR e o agregado dos scrapers mantiveram `degraded, limited:true`, com todas as íntegras da amostra lidas; RN/AL/SC ficaram `ok`. O Querido Diário confirmou novamente 503 em todas as rotas e ficou `error`. Araguaia, Portal da Cidade e Alto Paraopeba permaneceram `http_403`, sem falhas técnicas dos leitores; não foram declarados recuperados.

Não há novo servidor, dependência, assinatura, agendamento recorrente ou chamada paga de IA nesta validação. A API QD e as páginas com 403 **não estão declaradas recuperadas**. O estado operacional de saúde só reflete a nova regra quando uma coleta regular persistir sua observação; não foi editado manualmente para zerar alertas.
