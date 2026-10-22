# Reprocessamento dos 310 registros — 22/10/2026

O crescimento de 1 para 310 revisões não representava 309 dúvidas documentais novas. Duas coletas reabriram 182 rejeições e encaminharam 127 registros novos para revisão. O motivo dominante era a ausência de uma regra conclusiva/segunda leitura. As 38 decisões da revisão conjunta anterior permaneceram preservadas.

## Resultado do lote

| Resultado | Registros |
|---|---:|
| Confirmados com categoria, etapa e prova | 24 |
| Rejeitados após triagem de escopo/leitura | 281 |
| Revisar comigo: conflito documental específico | 2 |
| Em processamento automático: acesso/leitura pendente | 3 |
| Total | 310 |

O painel completo inclui uma nova coleta automática incorporada durante a manutenção: **3.113 registros, 212 confirmados, 2.874 rejeitados, 2 em revisão e 25 em processamento**. A coleta acrescentou 94 documentos: 2 confirmados, 70 rejeitados e 22 com leitura automática pendente. Os 3 pendentes do lote original estão incluídos nesses 25. Novas notícias podem alterar os totais.

Todos os 310 continuam bloqueados para alerta e resumo retroativo. O estado de entregas, a fila de envio, as sessões, as 454 revisões existentes e o lote histórico original de 69 não foram modificados por esta manutenção. A sincronização local incorporou a recuperação automática `feafce0` do GitHub antes de concluir o trabalho; a coleta `e880a35` também foi incorporada, preservando seu estado e seus recibos.

## As duas dúvidas reais

### Pendência anterior: caso 31 dos 39

[Aditivo de rateio de Planalto Alegre](https://diariomunicipal.sc.gov.br/atos/8821385).

Conferir os valores **R$ 13.925,40 / R$ 413.925,40**, as referências **076/2025 / 76/2026** e a assinatura municipal. Uma retificação ou explicação oficial e a conferência das assinaturas podem resolver o conflito. A numeração e a decisão do relatório dos 39 permanecem intactas.

### Nova dúvida: destinatário da autorização de Aiuaba

[Lei 287/2025 publicada na APRECE](https://www.diariomunicipal.com.br/aprece/materia/A14A7668). [Cópia na Câmara de Aiuaba](https://cmaiuaba.ce.gov.br/arquivos/275/LEI_MUNICIPAL_287_2025_0000001.pdf).

A ementa cita o Consórcio de Desenvolvimento Econômico e Sustentável do Sertão dos Inhamuns. O art. 1º cita o Consórcio Intermunicipal de Governança Cooperativa para o Desenvolvimento Sustentável dos Municípios do Semiárido Cearense. A lei autoriza participação; não comprova saída nem ingresso efetivamente homologado.

Conferir no protocolo/CNPJ se os nomes designam a mesma pessoa jurídica. Se forem diferentes, localizar retificação ou confirmação oficial do destinatário. A [notícia do Governo do Ceará](https://www.ce.gov.br/sde/2025/08/05/governo-do-ceara-por-meio-da-sde-lanca-consorcio-de-desenvolvimento-economico-e-sustentavel-do-sertao-dos-inhamuns/) confirma o grupo regional, mas não resolve por si só a divergência dos nomes da lei; não foi usada como prova de equivalência.

## Pendências do bot, sem tarefa para o usuário

- Lei 2.210/2026 da AMM-MT: publicação acima do limite de páginas do leitor dessa fonte.
- Santa Cruz das Palmeiras/Portal da Cidade: leitura bloqueada com HTTP 403.
- PDF da Câmara de Passa Quatro: HTTP 403 na leitura direta.

Esses registros permanecem visíveis em **Em processamento automático**. A recuperação existente tenta novamente com limites e intervalo progressivo, sem expirar após três falhas. Não se afirma recuperação enquanto a leitura não ocorrer. PDFs completos recuperados voltam à triagem por regras; documento digitalizado ou truncado não é registrado como íntegra.

## Regra permanente do fluxo

1. Filtrar o escopo antes de exigir leitura/IA de toda manchete de feeds gerais.
2. Aplicar decisões humanas lacradas antes de qualquer conclusão automática.
3. Distinguir o objeto do documento de citações em fundamentos, anexos e cláusulas condicionais.
4. Confirmar/rejeitar com evidência e etapa explícita. Autorizações, propostas, obras em andamento e pagamentos não são etapas intercambiáveis.
5. Falta de texto, citação inválida ou segunda leitura pendente são processamento do bot. Só um conflito específico de conteúdo chega a **Revisar comigo**.
6. Uma releitura ausente/incompleta não substitui decisão concluída. Catálogo, painel e CSV usam a mesma decisão guardada.
7. Cada dúvida resolvida deve produzir uma regra reutilizável e teste com contraponto; não acumular exceções por nome/URL nem aceitar conteúdo apenas para zerar um contador.

## Evidência e reprodução

- `data/catalogo/reprocessamento-310.json`: lista estável dos 310 IDs, decisão anterior, resultado e prova.
- `data/catalogo/triagem-reprocessada.ndjson`: decisões automáticas ligadas ao registro e ao hash do texto, com bloqueio retroativo.
- `scripts/reprocess-triage.mjs`: reprocessamento offline, sem importação de WhatsApp ou cliente de IA. O lote pode ser reproduzido com `node scripts/reprocess-triage.mjs --ids-file=data/catalogo/reprocessamento-310.json`.
- `tests/triage-flow.test.mjs`: duas rodadas de observação → catálogo → painel/CSV; recuperação de texto que retoma a triagem; proteção dos 310 e do histórico.
- `tests/test_pdf_complete_text.py`: texto de todas as páginas, omissão de identificadores e bloqueio de falsa íntegra quando o corpo é imagem.

Os testes usam ambiente isolado, com persistência, IA e mensagens desligadas. Uma coleta real futura continua sujeita à disponibilidade das fontes e ao agendador do GitHub; a aprovação dos testes não demonstra uma nova conexão de WhatsApp.

Validação local: **548 testes do projeto e 5 testes de PDF aprovados**; painel e CSV conferidos para 3.113 registros, com partes verificadas sem perda. A interface foi aberta em navegador isolado, com dois registros no filtro humano, 25 no processamento (3 do lote e 22 da coleta incorporada) e nenhum erro de execução. Nenhum envio, reenvio ou chamada à API de IA foi feito nesta manutenção.
