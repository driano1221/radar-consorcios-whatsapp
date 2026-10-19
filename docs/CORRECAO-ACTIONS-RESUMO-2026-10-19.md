# Actions e resumo semanal — 19/10/2026

## Problemas confirmados

- Seis rodadas consecutivas falharam antes da coleta: uma recaptura do Semana 7 substituiu o trecho lacrado de uma revisão de duplicata. Dos 424 testes, dois falhavam corretamente.
- A etapa `always()` tentava criptografar uma sessão que não havia sido restaurada, produzindo erro secundário enganoso.
- Radar e resumo, disparados contra o mesmo commit, salvaram versões divergentes do estado. A fila de concorrência serializava execução, mas o checkout ainda podia usar o commit antigo do disparo.
- O resumo de 10–17/10 tinha três itens e uma parte enviada. Não houve truncamento: a seleção reutilizava a regra de alertas e excluía fatos confirmados marcados para não reenviar.

## Correções

1. Preservar trechos revisados em todo merge de observações e fila; restaurar somente o trecho exato de Semana 7 que corresponde ao hash já aprovado. A íntegra recuperada permanece no repositório de textos, sem substituir a prova lacrada.
2. Criptografar sessão apenas após restauração bem-sucedida; não tentar salvar sessão inexistente. Os quatro workflows escritores continuam serializados e fazem checkout da ponta atual da branch quando iniciam.
3. Testar novamente após atualizar o catálogo; só persistir catálogo se essa validação passar. Confirmações de envio continuam persistindo mesmo após falha posterior, evitando reenvios.
4. Criar seleção semanal independente: decisões documentais lacradas podem entrar no resumo pela publicação original, mesmo com `publicar:false` para o alerta individual. A decisão individual não muda. Revisões sem data comprovada e republicações de fatos de meses antigos não viram novidade.
5. Respeitar decisões humanas na revisão semanal; a IA continua revisando os itens não confirmados. Resposta adiada impede o envio de um resumo incompleto.
6. Reconstrução histórica é exclusivamente prévia: `SEND_ENABLED=false`, `WEEKLY_REBUILD_PREVIEW=true`, `WEEKLY_REFERENCE_TIME=2026-10-17T20:13:00Z`. Usar referência ou reconstrução com envio ativo falha antes de conectar ao WhatsApp. Edição já enviada e recibos permanecem intocados.

## Casos de regressão

- CIMSAMU/Castro: primeiro aditivo ao rateio 094/2026, publicado em 14/10. Entra na edição 10–17/10; não entra na edição seguinte e não volta à fila individual.
- Campo Mourão/CISCOMCAM: autorização para formalizar rateio, publicada em 09/10, ato de 29/09. Não entra na edição 10–17/10; não é contrato assinado.
- CONIAPE: assembleia e visita realizadas, publicação de 15/10. Entra no resumo, preservando o envio individual anterior.
- Leis de junho/agosto republicadas em outubro: permanecem históricas, sem serem apresentadas como fatos novos.
- Atos de TCE individualizados mantêm documento, páginas, datas e identidade próprios; a notícia-mãe não é somada de novo.

## Validação

- Local: 429 testes aprovados; `npm run check` aprovado.
- Testes reais reaplicam o estado em memória duas vezes, simulam nova fila, verificam todos os hashes editoriais e a integridade dos recibos.
- Workflow `validate-weekly-safety.yml`: sem credenciais de WhatsApp, com envio desativado; valida testes, prévia histórica, imutabilidade de `state/` e `data/` e painel público. Artefatos incluem texto, relatório, auditoria editorial e auditoria da IA.
- Nenhum resumo corrigido deve ser enviado nesta manutenção. A prévia é apresentada ao usuário antes de qualquer novo envio.
- [Actions 39246914074](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/39246914074): aprovado. **3 → 15 achados** na edição 10–17/10, 13 confirmados documentalmente e dois aprovados pela IA em cache; zero chamadas novas. Cinco itens continuam rejeitados pela revisão da IA. A notícia-mãe do TCE não é repetida; os atos confirmados usam suas próprias datas de publicação. `state/` e `data/` ficaram intactos durante a prévia.
