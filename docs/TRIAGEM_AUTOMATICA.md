# Triagem automática — estado em 21/10/2026

## Fluxo em produção

**Coletar → ler o original → decidir com prova → confirmar ou rejeitar → considerar o WhatsApp.** Falta de texto, discordância, listagem sem notícia individual e possível duplicidade ficam em **Revisar comigo**, com fonte e roteiro de conferência. Confirmar o conteúdo não remove os controles de data, novidade, cota ou preferência de canal.

O painel usa sete famílias: **Criação, Adesão, Saída, Rateio, Protocolo, Crise e Atuação**. Governança, Finanças e Controle/Fiscalização aparecem como subtipos de Atuação. As etapas jurídicas continuam explícitas: autorização não equivale a ingresso, assinatura não equivale a pagamento. Controle/Fiscalização continua somente no painel, inclusive fora do boletim do WhatsApp.

`simple-triage.mjs` aplica uma decisão canônica aos originais e ao envio diário. Confirma por regra documental específica ou concordância da regra com uma segunda leitura válida e evidência literal no corpo. A regra independente é preservada antes de aplicar a opinião da IA. Rejeição exige prova de exclusão; falha de acesso nunca é irrelevância. O resumo semanal preserva a decisão canônica guardada, exige confirmação e continua excluindo as revisões históricas deste lote.

## Lote inicial: as 69 pendências

**Atualização após a revisão conjunta dos 39 casos:** 22 confirmações, 12 rejeições, quatro documentos complementares/duplicados e uma pendência (caso 31, aditivo com valores, ano e assinatura divergentes). O [resultado preserva os números originais](REVISAO-CONJUNTA-39-2026-10-21.md). As 416 revisões anteriores e o arquivo bruto foram mantidos; foram acrescentadas 38 decisões, todas com `publicar=false` e `incluir_resumo=false`.

Conferência reproduzível: `node scripts/apply-joint-review-39.mjs` simula; `--apply` aplica somente se ainda faltar o lote completo. A aplicação é idempotente, valida provas e hashes e não importa clientes de rede/WhatsApp. O script inicial abaixo passa a preservar o relatório congelado quando encontra revisão humana posterior.

As regras aprendidas distinguem LDO e cronograma de um rateio assinado, conselho consultivo de protocolo, ratificação legal de ingresso e cooperação autorizada de criação. Normas operacionais publicadas com prova literal não exigem revisão só por serem longas ou por uma interpretação antiga da IA. O aceite do credenciamento do caso 38 é uma inclusão expressa desse caso pelo usuário; não amplia automaticamente o escopo para todos os contratos de fornecedores. Valores dessa notícia secundária continuam sem conferência independente no diário.

- Escopo congelado em `triagem-simples-lote.json`, a partir do painel de 21/10 às 16h41 de Brasília: **29 confirmadas, uma rejeitada e 39 em Revisar comigo**.
- Reutilizados somente textos com hash válido e leituras já guardadas. Zero chamadas adicionais à IA e zero conexões/envios ao WhatsApp na reconciliação.
- Decisões separadas em `triagem-originais.ndjson`, vinculadas a ID, URL, título, trecho e hash da íntegra. Mudança nesses dados invalida a decisão e mantém o bloqueio histórico.
- Guardas protegem URL capturada e URL original contra alerta individual e boletim. Nenhum dos 69 é liberado para envio retroativo, mesmo quando confirmado.
- Revisões documentais anteriores, recibos, fila, sessão e arquivo bruto preservados. O painel passa de 135 a **164 fatos confirmados**, nesta fotografia; não são 29 novas coletas ou 29 novos consórcios.
- [Lista separada para revisão conjunta](REVISAR-COMIGO-2026-10-21.md): cada caso tem link, dúvida e o que conferir. Responder com número/ID, conclusão e trecho/página. A solução deve ampliar regra e teste reutilizáveis.

Reprodução offline, sem acesso a fontes ou envio: `node scripts/reconcile-simple-triage.mjs`. Ele trabalha exclusivamente sobre o lote congelado; não substitui revisões documentais já existentes. A geração regular do catálogo e painel projeta as decisões desse registro auxiliar.

## O que já funciona sem pedir uma decisão a cada notícia

1. **Descoberta e leitura:** coletores, Readability/Trafilatura, leitores de portais, PDF e OCR seletivos. CNM usa o conteúdo público estruturado da notícia individual; seu índice fornece apenas um resumo.
2. **Interpretação com evidência:** distingue autorização de ingresso, assinatura de protocolo, ingresso comprovado, atuação realizada, composição já documentada e simples convocação. Reunião conduzida pelo consórcio pode ser atuação; mera presença não. Composição não revela ano de ingresso. Contratos rotineiros com fornecedores continuam fora do escopo.
3. **Novidade:** URL, identidade de ato e assinaturas conservadoras de episódios de atuação evitam contar reproduções como novos fatos. Não é uma deduplicação semântica universal.
4. **Fonte alternativa:** para novos registros elegíveis, compara episódio, datas e entidades; exige concordância entre regra e DeepSeek, justificativa e trechos literais. A decisão pode aceitar ou descartar na base. Cada texto mantém URL, hash e proveniência próprios. Discordância não é resolvida escolhendo arbitrariamente uma leitura.
5. **Envio separado:** novidade, data, fonte homologada, cotas, fila e revisão da IA. Aceitar na base não autoriza reenviar. Revisões históricas e seus bloqueios de envio permanecem protegidos.

## O que ainda falta para depender menos de revisão manual

| Lacuna real | Próxima implementação | Critério de validação |
| --- | --- | --- |
| Casos ainda sem regra documental conclusiva | Revisar comigo, comparar prova e ampliar a regra geral | Teste positivo e negativo; manter bloqueado enquanto não houver conclusão |
| Texto bloqueado, incompleto ou PDF com muitos atos | Recuperação com tentativas limitadas; identificar ato e página; conferir equivalência da alternativa | Nunca descartar pelo simples 403; não usar trecho de outro ato para confirmar |
| Consórcio/município ambíguo | Identidade apoiada em evidência e cadastro de referência | Não inventar CNPJ nem filiação; orientação geral CNM pode entrar sem entidade específica |
| Casos novos ou discordâncias | Registrar tipo de falha e ampliar testes/regras reutilizáveis | Novos testes negativos e comparação de antes/depois; não criar exceção por ID como regra geral |

A meta é **aceitar ou descartar o conteúdo quando a evidência permitir**. Uma falha de acesso é uma pendência de leitura, não uma conclusão de que não existe fato. Nenhum extrator ou LLM garante acerto de 100% em textos futuros. Revisão manual deve ficar concentrada nas exceções reais, com amostragem de qualidade também dos aceites e descartes automáticos.

## CNM aplicada

- Descoberta ativa: Google Notícias com filtro CNM. Listagem direta `https://cnm.org.br/areas_tecnicas/consorcios/noticias` preparada, mas **desativada após HTTP 403 no Actions**. Abriu localmente; isso não homologa o servidor de produção.
- Coletor preparado limita a três páginas individuais por rodada, com leitor Inertia validando rota, slug, ID, componente, conteúdo e data. O mesmo leitor já é usado em notícias descobertas por outros coletores.
- Resumo da listagem não ocupa o campo de íntegra. Erro de acesso ou leitura adiada mantém o item em prévia sem envio.
- Corte de alertas: data original a partir de **17/10/2026**. A manutenção não chama WhatsApp e não altera o estado de envio.
- Recuperação diária inclui CNM: busca pública e REST público do Conclima, preservando a fonte alternativa. Não é uma API geral documentada da CNM nem garantia de acesso a todas as páginas.
- Orientações gerais de consórcios não recebem uma entidade fictícia. Protocolo, atuação e composição continuam sujeitos ao alcance real do documento.
- Diagnóstico distingue o índice bloqueado, notícias com acesso variável e alternativas disponíveis. O teste reprova uma configuração que habilite a listagem sem leitura real comprovada; com a listagem desativada, registra o 403 sem interromper as outras rotas.

## Onde acompanhar a implementação

`institutional-proof.mjs` interpreta os novos padrões; `event-proof.mjs` integra a classificação; `ai-review.mjs` limita a reinterpretação pela IA; `alternative-triage.mjs` decide usando fontes alternativas; `catalog.mjs` aplica revisões e decisões válidas; `publication-gate.mjs` controla elegibilidade de alerta. `cnm-reader.mjs` e `sources/web-scrapers.mjs` fazem leitura e coleta CNM. O fluxograma do painel distingue a base e o envio e mostra a recuperação alternativa.

As revisões anteriores de 10, 13 e 4 registros são lotes históricos auditados, não prova de que todos os documentos futuros já dispensam conferência. Os testes de aplicação idempotente protegem esses lotes contra duplicação e reenvio.
