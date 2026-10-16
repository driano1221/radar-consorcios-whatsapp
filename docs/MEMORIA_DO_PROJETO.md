# Memória do projeto — Radar de Consórcios

Atualização mais recente: **16 de outubro de 2026**. As primeiras seções são um registro histórico da implantação original; números, agendas e decisões antigas nelas descritos foram substituídos pelas atualizações datadas. Para operação corrente, use também o [README principal](../README.md) e os workflows versionados.

## Simulação v7 e integração das provas — 16/10/2026, atualização mais recente

- Pedido: integrar Divinópolis e três processos do TCE, testar amostra adicional e alinhar código, **sem ativar nem reenviar**. Branch `test/original-triage-v7`; nenhuma alteração na base, estado de envio, agenda ou configuração de produção.
- Integradas revisões aprovadas, com conferência de hash do PDF, página, trecho, selo e identidade canônica. Duplicata Divinópolis aponta ao fato existente. Três segmentos TCE resolvidos; divergência CONSANE preservada e vinculada explicitamente, sem fuzzy matching.
- Repetidos 118 documentos anteriores; nenhuma mudança fora da integração aprovada. Mais 12 corpos do acervo (não novas coletas): resultado final 4 aceitos, 5 descartados, 3 retidos. Reeleição CISMIV passou sem afirmar posse; CIMU retido por prova histórica usada para chamamento atual; CNM retida no experimento de originais por título SC/corpo PR; Cisa continua sem íntegra. Não alterar as revisões anteriores por fonte alternativa a partir deste teste.
- 508 testes locais; pacote público compilado sem publicar; 12 chamadas novas e replay congelado sem API. Respostas brutas e referência anterior preservadas. Primeira execução experimental falhou antes da API por segmento sem texto; erro do runner corrigido e coberto por teste.
- [Relatório, antes/depois, comandos e próximos passos](SIMULACAO-ORIGINAIS-V7-2026-10-16.md). Workflow final somente leitura, sem segredos de IA/WhatsApp. Preparado não significa ativo; próximos passos são resolver as três exceções, testar amostra independente e apresentar ativação.
- Validação final [38980852455](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38980852455), `9aa5945`: aprovada; artefato com 130 resultados idênticos aos locais. Build público aprovado sem deploy, dados/estado/configuração intactos. Código, memória e relatórios publicados somente na branch experimental, não mesclados ao `main` nesta rodada.

## Aplicação documental retroativa: Divinópolis e TCE-MG — 16/10/2026

- Usuário autorizou aplicar as correções previamente apresentadas, atualizar o painel e preservar fontes/divergência do CONSANE, sem duplicar nem reenviar. Aplicação isolada da branch experimental: **não ativada a triagem automática de originais**. Sua simulação anterior permanece 80/82, não 82/82 automático.
- Divinópolis: Lei 9.770/2026 sancionada/publicada autoriza **subscrever extinção** do Mulheres das Gerais; não comprova extinção ou saída consumada. Segunda URL com corpo idêntico tornou-se duplicata do mesmo fato.
- TCE-MG: notícia desdobrada em três acórdãos. 1214381/CIMINAS: referendo cautelar. 1210770/CIMINAS: extinção do processo sem mérito e multa de R$ 10 mil **ao presidente por não informar a revogação**, não ao consórcio. 1217968/CONSANE: referendo cautelar. Multas condicionais dos outros dois não são multas aplicadas.
- CONSANE: mantidos número **1217068 e nome equivocado da notícia**, separados de **1217968 / Consórcio Regional de Saneamento Básico** no acórdão. Associação editorial contextual, sem errata oficial nem conversão automática por semelhança.
- Cinco PDFs primários preservados com SHA-256, texto por página, trechos e histórico de revisões. Manifesto `data/catalogo/documentos-primarios-2026-10-16.json`; PDFs `data/documentos-primarios/`. [Auditoria detalhada](VALIDACAO-DIVINOPOLIS-TCEMG-2026-10-16.md).
- Painel: seção de documentos oficiais com página, trecho e link; aviso explícito de divergência; fluxo desktop/mobile inclui revisão documental autorizada. Repositório continua hospedando o mesmo painel, com atualização automática pelo workflow Pages.
- Antes/depois deste lote: **1.982 publicações originais mantidas; 7 → 10 atos individualizados; 117 → 119 fatos confirmados exibidos no painel; 31 → 32 duplicatas**. Não são novas coletas. A notícia TCE deixa de contar como um fato genérico; passa a três. Divinópolis permanece um episódio, atualizado com a lei.
- Proteção: os seis registros afetados têm `publicar:false`; guardas de URL agora incluem os atos derivados/PDFs e links diretos da publicação-mãe. Testes simulam data nova para impedir reenvio diário e semanal. Estado de WhatsApp e arquivo bruto não foram alterados; nenhuma rotina de envio foi executada nesta manutenção.
- Validação local: **424 testes aprovados**, incluindo oito regressões novas; reaplicação sem efeito, hashes dos cinco PDFs, páginas/trechos, quatro fatos únicos, segurança do HTML e bloqueio diário/semanal. Corrigida identidade duplicada por corte no hífen quando o mesmo nome completo já foi revisado; catálogo final: **74 identidades e 100 vínculos**, sem presumir validação de CNPJ. Datas dos atos derivados agora identificam separadamente a coleta da publicação de origem.
- Aplicador idempotente `scripts/apply-primary-document-corrections.mjs`; workflow `validate-documentary-corrections.yml` testa o lote sem segredos de IA/WhatsApp, sem coleta e sem disparos. A versão de produção continua com suas regras atuais; ampliar automação requer nova validação/aprovação.
- **Actions aprovado:** [38970681230](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38970681230), commit `85b9740`: 424 testes, reaplicação sem efeito, pacote público validado e `git diff --exit-code HEAD -- data state` limpo no runner Linux. Conferidos no navegador: busca por CONSANE/Divinópolis, ficha e notícia preservada, base filtrada por CIMINAS, indicadores e fluxo; nenhum erro de console observado.

## Integração CNM e limite real da autonomia — 16/10/2026

- Usuário autorizou aplicar CNM e pediu explicação do que falta para aceitar/descartar sem revisão manual, além de atualizar memória, repositório e fluxo.
- O leitor CNM e a busca de alternativas já estavam integrados, mas a listagem direta estava desativada. Preparado coletor com até três íntegras por rodada. Corrigido um risco: `conteudo` na listagem é um resumo truncado, não texto completo. Só a página individual com estrutura Inertia validada libera a prévia; bloqueio ou limite mantém item sem envio.
- Corte de alertas por data original: **17/10/2026**. Não se abre envio retroativo nem se altera `state/`, revisões ou acervo nesta manutenção. Orientação CNM geral não exige inventar entidade.
- **Limite explicitado:** as novas regras melhoram a classificação futura, mas não implementam confirmação automática universal de originais. Fontes alternativas já têm decisão automática com regras + DeepSeek e evidência literal. Próximo passo é política equivalente para originais, primeiro em simulação contra o acervo validado; depois identidade e segmentação de PDFs. Falha de acesso não pode virar descarte temático.
- README, arquitetura, texto acessível e fluxogramas desktop/mobile atualizados; criado [estado da triagem automática](TRIAGEM_AUTOMATICA.md). Corrigida descrição da tabela que atribuía toda confirmação exclusivamente à revisão editorial.
- Validação local: **416 testes passaram**; cinco novos cobrem resumo versus íntegra, 403, limite por rodada, ausência de entidade fictícia e corte de alerta antigo. Teste real local recuperou orientação CNM de 13/10 com 2.726 caracteres, classificada como FINANÇAS / orientação geral e bloqueada para envio histórico.
- **Primeiro Actions [38956044748](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38956044748):** testes passaram, mas o diagnóstico vetou a ativação: índice CNM HTTP 403. Notícia Conclima abriu (1.817 caracteres); notícia tributária retornou 403 nesta execução, apesar de abrir em execução anterior. REST Conclima trouxe cinco textos. A ativação foi retirada antes de publicar no main; descoberta Google, leitor individual e alternativas continuam aplicados. Não tratar falha como sucesso nem prometer desbloqueio universal.
- **Validação final [38956333162](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38956333162), commit `7a2e6e3`:** sucesso com 416 testes, lotes históricos idempotentes, pacote público validado, leitores reais e invariantes de `data/` e `state/`. Diagnóstico registra índice CNM 403 e `productionEnabled:false`; sucesso do workflow não significa desbloqueio. Fluxograma conferido visualmente no painel local. Acervo preservado: 1.982 publicações e 117 fatos confirmados; nenhuma chamada de WhatsApp nesta manutenção.

## Generalização das revisões e leitor CNM — 16/10/2026

- **Fechamento validado no Actions:** [38952698901](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38952698901), código `d3ac6e7`: **411 testes aprovados**, quatro leituras reais aprovadas, aplicação idempotente e `data/state` intactos durante validação. Na rede do GitHub, a orientação tributária CNM abriu com 2.726 caracteres; o artigo Conclima da CNM e sua variante `api.cnm.org.br` ainda deram 403. PDF CNM, RSS Conclima e REST Conclima responderam. Portanto, o bloqueio é parcial, não declarar CNM universalmente liberada. Primeiro ensaio 38952429515 detectou justamente o 403; não foi omitido, e o diagnóstico separado continua exibindo essa limitação.
- Durante o trabalho, o agendamento normal (`25ff119`) acrescentou 36 publicações e 15 leituras originais, com um envio operacional independente. Incorporado integralmente, sem alterar seu estado. Painel final desta manutenção: **1.982 publicações, 117 confirmados, 31 duplicatas, 71 identidades e 96 vínculos**, sem candidatos pendentes no painel. Textos originais completos: **263** (247 iniciais + 15 da coleta + 1 original CNM recuperado).
- Replay repetido sobre o corpus final com as regras antigas (`--baseline-ref 2c3b5d6`) versus novas: **1.985 leituras**, 122 → 135 reconhecidas como relevantes antes de deduplicar/aplicar revisões; 15 leituras/14 documentos alterados, todos conferidos. As 36 publicações novas não tiveram mudanças causadas pelas novas regras. Ver [auditoria estruturada](auditoria-regras-2026-10-16.json). Os números abaixo documentam o snapshot inicial e a aplicação, não a última coleta.

- Pedido: generalizar os casos, medir todo o acervo, aplicar apenas o delta conferido e jamais reenviar antigos. Replay fixo em **1.946 publicações + 3 leituras alternativas**, com **247 textos originais completos** disponíveis no início. O restante foi avaliado com o fragmento preservado: não confundir replay completo do acervo com leitura integral de todas as páginas.
- Regras: consórcio como agente de visita/reunião realizada; acordo de cooperação técnica firmado; composição municipal expressa mesmo dentro de notícia de seleção; assinatura municipal de protocolo sem afirmar ingresso efetivo; descarte de convocação sem realização. Exigem prova no corpo, não só no título. Regras específicas de atos legais/controle prevalecem. A IA recebeu os mesmos critérios (prompt v6) e não pode promover composição a adesão nem reunião a constituição.
- No corpus fixo, **15 leituras mudaram** (14 documentos, um com original e alternativa): **12 passaram de rejeição para relevância textual**, três ganharam enquadramento/prova mais específicos sem mudar aceite. Isso NÃO representa 12 fatos novos. Todas as mudanças foram examinadas; as revisões anteriores seguem protegidas.
- Delta histórico aplicado: **dois fatos novos** (visita do ABC a Taubaté; reunião de reconversão industrial) e **duas duplicatas** (Braskem; Metodista). Painel após aplicação local: **115 → 117 confirmados**, **29 → 31 duplicatas**, **94 → 96 vínculos documentais**, 71 identidades e 1.946 publicações mantidos. Provas e justificativas em `revisoes-eventos.ndjson`, lote `regras-gerais-2026-10-16`; `publicar:false`, links Google e diretos bloqueados para alerta/resumo. Não houve execução de envio nesta manutenção.
- Deduplicação: chave conservadora por prova literal normalizada de atividade/acordo, dia/mês explícitos e ano conhecido. Fontes já marcadas como duplicatas podem fornecer assinatura textual ao episódio canônico confirmado. Não se trata de deduplicação semântica universal; títulos parecidos e datas ausentes não bastam.
- **CNM: diagnóstico corrigido.** Foram observados 403 reais em acessos simples, mas também HTTP 200 com íntegra dentro de `#app[data-page]` (Inertia). O detector anterior confundia HTML visualmente vazio + script passivo com desafio. Novo leitor `cnm_inertia_publica` valida domínio, componente, caminho e slug; lê só `props.noticia.conteudo`, ignora relacionadas e recusa CAPTCHA real. Recuperados localmente os originais do Conclima (1.817 caracteres) e orientação tributária (2.726). A íntegra do primeiro foi adicionada sem remover a reprodução separada. Agora há 248 leituras originais completas nesse snapshot.
- Formatos públicos testados: artigo CNM, domínio público alternativo `api.cnm.org.br`, PDF público da CNM, RSS Conclima e REST WordPress Conclima. API/RSS Conclima funcionaram localmente; a API retornou cinco textos, RSS dez entradas. Não significa cobertura de toda CNM nem API CNM documentada. Recuperação automática agora inclui CNM e pode buscar republicações; correspondência, conflitos e segunda leitura continuam obrigatórios. Não relaxar comparação para corrigir automaticamente Santa Catarina/Paraná.
- Scripts: `audit-general-rules.mjs --baseline` e sem flag fazem comparação sem escrever na base; `apply-general-rule-review.mjs` prepara/aplica lote fixo e é idempotente; `validate-cnm-access.mjs` testa rede sem credenciais de IA/WhatsApp e verifica arquivos protegidos. Resultados de rede são condicionais ao ambiente; confirmar no Actions antes de declarar acesso contínuo resolvido.


Este documento registra o contexto, as decisões e o estado operacional do projeto para que o trabalho possa ser retomado sem depender do histórico da conversa. Ele não contém telefone, ID do grupo, senha ou material de autenticação aberto.

## Revisão dos treze históricos restantes — 16/10/2026

- Aplicados os 13 registros autorizados: **5 confirmações, 4 duplicatas e 4 descartes**. Recuperadas 12 leituras originais e uma reprodução oficial alternativa. Acervo permanece em **1.946 publicações**, fatos confirmados passam de **110 para 115**. Os outros fatos, os originais e `state/` ficaram intactos; todos os 13 têm `publicar:false`, inclusive para o resumo semanal.
- Decisões do usuário: aproveitar a composição explicitamente documentada do consórcio de acolhimento; incluir visitas e reuniões conduzidas pelo ABC e realizadas; **descartar simples convocações**, conservando-as no acervo. Não confundir presença passiva com atuação, assinatura de protocolo com ingresso concluído, nem pautas com deliberações.
- Acolhimento: quatro relações municipais documentadas em 2026, ingresso original desconhecido. AMURC é associação apoiadora, não sigla do consórcio. Conclima: fonte oficial alternativa identifica **Paraná**, corrigindo título indexado que dizia Santa Catarina; assinatura por 12 municípios não nomeados, sem gerar 12 vínculos presumidos.
- Três textos ABC–Metodista foram ligados ao acordo já confirmado, não somados como novo acontecimento. PDF de Indaiatuba é duplicata byte a byte de despacho de 2024, não aprovação legislativa de 2026.
- Correções reutilizáveis: leitura da API pública usada pelo portal CIMCERO, com validação de ID/título e exclusão de notícias relacionadas; tolerância ao charset HTTP inválido com declaração válida no HTML; impedir associação indevida de “GCM” ao consórcio; suporte a vários municípios explicitamente documentados na mesma revisão.
- **394 testes Node passaram localmente**, mais leitura real das quatro rotas afetadas. Aplicação repetida é no-op. Painel público gerado e validado, com original, reprodução e justificativa separados. Conferência documental pelo assistente e critérios aprovados pelo usuário; não simular aprovação humana de cada frase.
- **Actions confirmado:** [38948706793](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38948706793), commit `c62abe0`, concluiu testes, aplicação idempotente, leitura real das quatro rotas e invariantes de dados/estado com sucesso. [Publicação do painel](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38948707383) também concluída. Não foi disparada coleta nem workflow de WhatsApp nesta manutenção.
- Inventário específico de históricos sem revisão e com lacuna registrada: **13 → 0**. Isso não significa acesso universal ou ausência de outros erros. O original CNM continua bloqueado; sua reprodução fica separada. As regras genéricas de atuação e composição não foram ampliadas indiscriminadamente: neste lote são revisões documentais protegidas. Ver [resultado e limites](REVISAO-HISTORICOS-13-2026-10-16.md).

## Aplicação autorizada dos dez históricos — 16/10/2026 (etapa anterior)

- Usuário aprovou os dez, atualização do painel e inventário antes de ampliar. Aplicados **5 aceites, 3 descartes e 2 duplicatas**, sem alterar os 1.946 originais nem o estado de envio. Painel: **110 confirmados**, antes 105. Dez textos integrais preservados com páginas/hash.
- Novos testes cobrem ausência de duplicação, prova literal e bloqueio dos links Google e PDFs diretos em alertas/resumo. 383 testes Node passaram; aplicação repetida foi no-op. Ano comprovado mostrado separado da primeira coleta; CISVAP com evidência 2025 e ingresso desconhecido.
- **13 registros restantes com lacuna registrada**: 1 do grupo original, 2 descartados explicitamente por falta de texto e 10 com outras recuperações incompletas. São URLs, não fatos nem episódios únicos. Recomenda-se priorizar 9; quatro têm sinais temáticos de descarte. Não ampliado. Ver [relatório de aplicação e lista dos 13](REVISAO-RETROATIVA-APLICADA-2026-10-16.md).
- `scripts/apply-retroactive-ten.mjs` só aplica o lote fixo aprovado; nova execução não grava. `scripts/inventory-retroactive-backlog.mjs` só lê. O corte temporal da triagem automática permanece intacto.
- A seção de piloto abaixo é histórica e foi superada pela autorização acima, não indica pendência de aplicação destes dez.

## Piloto retroativo de dez antigos — 16/10/2026 (histórico anterior à aplicação)

- Pedido: recuperar dez antigos e mostrar antes/depois antes de ampliar, sem duplicar nem reenviar. Os dez IDs foram congelados; nenhum tinha revisão humana ou envio. Proposta: **5 aceites únicos, 3 descartes justificados, 2 duplicatas**. Ver [relatório do piloto](PILOTO-RETROATIVO-10-2026-10-16.md).
- Recuperados os PDFs originais: 62 ocorrências de páginas (56 únicas), 11 com OCR. Não confundir com validação genérica da busca de fontes jornalísticas alternativas. Vargem Alta abriu localmente, mas deu 403 no Actions; recuperação desse arquivo não resolve acesso contínuo no runner.
- Casos aproveitáveis: CONVALE (etapa legal de protocolo, 2026), CONSPNOR (lei de Varre-Sai autoriza ingresso de Santa Maria Madalena, 2026), CONECTAR (autógrafo aprovado, 2021), CISVAP (alteração e permanência, 2025), CIM Norte (cofinanciamento autorizado, 2021). Nunca inferir ingresso original, pagamento ou constituição consumada além da prova.
- Defeitos corrigidos apenas na branch: Varre-Sai confundido com verbo de saída; autorização/minuta confundidas com constituição; permanência confundida com rateio; ata de cofinanciamento não reconhecida; cabeçalho textual escondendo corpo escaneado. 380 testes Node e 3 Python passaram localmente.
- Scripts só gravam resultados em output/, com hash dos 25 arquivos de data/ e state/ preservado. Projeção repetida em memória mantém 10 IDs, 5 fatos e elegibilidade de notificação falsa para todos. Zero chamadas de WhatsApp e zero chamadas à API de IA neste piloto. Conferência pelo assistente, **não aprovação humana simulada**.
- **Não aplicado em main, no catálogo ou no painel público.** Alterações estão na branch `fix/amm-triage-recovery`. Aguardar validação do antes/depois pelo usuário antes de aplicar ou ampliar. Não alterar o corte temporal da integração automática para forçar históricos a entrarem no fluxo de alertas.
- Validação final [38943846430](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38943846430): sucesso, testes e invariantes intactos; nove PDFs recuperados no runner, categorias conferidas; Vargem Alta continua 403 no Actions (resolvido neste piloto por cópia original baixada e OCR local, não acesso remoto reparado).

## Integração da fonte alternativa à triagem — 16/10/2026

- Pedido autorizado: usar a leitura alternativa para aceitar/descartar automaticamente os próximos casos, com fonte, prova e motivo no painel; preservar históricos e nunca reenviar antigos.
- Nova camada `triagem-fontes-alternativas.ndjson`, separada de `revisoes-eventos.ndjson` e do texto original. Aplicável somente a documentos com primeira coleta a partir de **16/10/2026 14h13min25s (Brasília)**, sem envio anterior nem revisão humana. O corte explícito protege o acervo anterior; não é um backfill.
- O fluxo valida hash/vínculo/URL/datas e lê o corpo integral (500–24.000 caracteres; nunca corta para concluir). Exige correspondência de episódio, três citações literais nos documentos corretos, justificativa específica e concordância entre regra determinística e DeepSeek. Havendo duas fontes, ambas precisam concordar; reprodução não conta como prova independente. Divergência/falha de acesso continua exceção explícita, não descarte sem prova.
- Aceitos alimentam a base derivada; descartados permanecem no arquivo consultável. A ficha identifica **regras e IA com fonte alternativa**, prova literal e URL própria; não simula decisão humana nem substitui título/data/texto original. Nova observação de um item guardado não pode copiar a prova alternativa para o trecho original.
- Antiduplicação: fonte já representada no arquivo ou compartilhada por decisões automáticas é relacionada ao dono anterior; se o dono ainda não foi validado, não se conta um segundo evento. Decisão humana sempre prevalece. Hash/versão/original alterados invalidam a decisão automática.
- Limites: dois documentos e quatro chamadas por passagem, doze chamadas/dia nesta etapa adicional. Sem chave, não decide. Resultado final idêntico não chama IA novamente; exceções esperam 24h. A triagem roda depois da recuperação diária (03h37, Brasília, melhor esforço), sem alongar o trabalho normal de envio/sessão do WhatsApp. As coletas posteriores respeitam as decisões salvas. Esta integração **não libera alertas**, nem diário nem semanal.
- Validação dedicada: workflow `test-alternative-triage.yml`, com permissão de leitura, sem segredos do WhatsApp. Testa IA real em duas fontes do CISGA e controles sintéticos claramente rotulados; integração/idempotência em pasta isolada e invariantes de `data/`/`state/`. Resultados finais e links serão registrados após a execução.
- Primeiro teste real [38940591600](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38940591600): aceite ATUAÇÃO, duplicata e descarte rotineiro corretos. Controle negativo falhou: a IA presumiu erro de digitação para conciliar 900 com 100 pacientes. Nenhuma base/envio foi alterado. Correção: comparação determinística compartilhada entre busca e triagem, refeita com títulos/datas atuais, incluindo números de quatro ou mais dígitos, etapas incompatíveis e quantidades expressas no corpo. Conflito barra antes de chamar IA; versão da decisão incrementada para invalidar cache antigo.
- Segunda execução [38941008834](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38941008834) passou: 371 testes, três chamadas reais (duas fontes CISGA + controle de descarte), duplicata resolvida sem pagar nova chamada, contradição 900/100 barrada sem IA. Integração em cópia isolada aceitou e a repetição fez zero chamadas. Produção: zero decisões alteradas, zero chamadas, zero mensagens; invariantes de arquivo, revisões e estado preservados. Ficha testada no navegador com a resposta real da IA em amostra explicitamente isolada; prova, motivo, original e fonte alternativa distintos, sem erro no console.

## Fontes recuperadas na ficha do painel — 16/10/2026

- Pedido: ver fonte alternativa, texto e justificativa sem confundir com o original. A ficha agora separa decisão/prova, publicação original e leituras auxiliares. Link “fonte usada na decisão” é distinto de “publicação original”.
- `scripts/dashboard-recovery.mjs` valida hash, liga pelo ID original, elimina repetição de URL e exporta apenas os campos necessários. Não muda evento, classificação, contadores nem envios. Fonte só aparece como citada quando uma revisão editorial válida aponta para a URL; nas demais há aviso explícito de não citação.
- Dois textos reais da validação Actions `38929375969` foram preservados em `fontes-alternativas.ndjson`, com os hashes/datas e link da execução: Rede da Notícia (2.114 caracteres) e Araguaia Notícia (2.358). Ambos relacionados a `0783e43a…` (Semana 7, 100 pacientes do CISGA), ainda duplicata. Ambos citam Semana 7; não representam confirmações independentes. Leitura Araguaia reaproveitada de 14/10, não nova abertura bem-sucedida do site.
- Site público: trechos de até 500 caracteres, links diretos e detalhes de proveniência; corpo integral excluído do pacote. Consulta local: texto completo expansível, separado por veículo. PDFs do próprio portal continuam identificados como originais, com marcadores de página na leitura local. Recuperação não equivale a decisão automática.
- Validação local: **353 testes Node**, incluindo oito novos testes de separação, integridade, segurança de links/HTML, versão pública, leitura do acervo e PDF original. Build público validado (1.946 publicações, sete atos, 8,32 MB). Conferência visual no navegador do Codex com a ficha real do Semana 7. Nenhum registro histórico ou estado de WhatsApp foi modificado.

## Leitura dos PDFs públicos e fontes alternativas — 16/10/2026

- Implementado `scripts/recover-public-documents.mjs` na recuperação diária, antes da recuperação HTML. Sem reclassificação nem envio, no máximo dois registros/passagem, espera progressiva para falhas e preservação das leituras completas existentes. Originais e fontes alternativas nunca são confundidos.
- **PDFs de Guanhães:** apenas armazenamento oficial PortalTP observado; valida protocolo, assinatura e tamanho, não segue redirecionamento desconhecido. Extração com pypdf por página; Tesseract português + Poppler para páginas escaneadas. Guarda hash do PDF, texto por página, leitor e pendências; só marca leitura integral quando todas as páginas produziram texto. Limites de 20 MiB, 80 páginas, 20 OCR e 100 segundos/processo; excedentes ficam explícitos. OCR pode errar caracteres e não é validação jurídica. Não substitui o acervo da Câmara.
- **Semana 7:** comparação de títulos específicos, números, negação e datas originais quando disponíveis. Reutiliza corpos integrais do acervo com URL e hash conferidos; se necessário, consulta Google Notícias e a API pública WordPress da Rede da Notícia, cujo endereço foi observado no HTML do portal. Não copia snippets de busca como prova. A API pública fornece `content.rendered`, diferentemente do RSS apenas resumido do Semana 7. Referência técnica: https://developer.wordpress.org/rest-api/reference/posts/ .
- **Proveniência/deduplicação:** texto de outro veículo vai para `fontes-alternativas.ndjson`, nunca para o registro de texto original do Semana 7. Traz fonte, URL, data, hash, data da leitura reaproveitada, link da API quando usado e `equivalencia_confirmada: false`; este é material para conferência, não confirmação automática de fato/identidade. Reprodução que cita Semana 7 não é prova independente. URLs normal/AMP observadas do Araguaia Notícia compartilham chave pelo ID da matéria. A recuperação não acrescenta documentos ao arquivo principal nem altera atos, decisões ou envios.
- **Primeiro teste no Actions:** [38928702257](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38928702257), commit `47b3c06`: passou 342 testes Node + 2 Python e leu as três páginas escaneadas do PDF público com OCR, mas falhou corretamente ao não obter o corpo da reportagem alternativa. Estado permaneceu intacto. Corrigido para registrar motivos técnicos de leitura, reaproveitar corpos integrais com hash conferido e pesquisar também a API pública de outro veículo. Não se interpretou sucesso local como garantia no runner.
- **Amostra PDF:** três páginas do Decreto 5.245/2026, usadas só para validar acesso/OCR. Renderizações das três páginas conferidas visualmente contra o texto extraído; não virou achado de consórcios. Os exemplos Semana 7/Araguaia/Rede da Notícia descrevem atendimento de 100 pacientes; novas leituras não criam novo evento para esse episódio antigo.
- **Validação local final:** 345 testes Node e 2 Python; casos de hash inválido, provedor bloqueado, cache separado, divergência numérica/temporal, negação, AMP duplicado, backoff, PDF parcial e dupla aplicação sem novos IDs/envios. Rotina e limites documentados no README do catálogo. Textos alternativos ainda exigem conferência antes de sustentar nova classificação; não se fechou automaticamente a decisão pelo título.
- **Validação final no GitHub:** [38929375969](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38929375969), commit `2f7783f`, sucesso. 345 testes Node + 2 Python. PDF oficial: 3 páginas/3 OCR, 3.553 caracteres, nenhuma página pendente; hash `5104c8abca249ad01323367e07634ddcae3ab0d2c27efa793b80de008a92bba0`. Busca externa sem acervo consultou os dois provedores (17 resultados) e recuperou 2.114 caracteres pela API pública da Rede da Notícia. Caminho com acervo também reutilizou 2.358 caracteres do Araguaia Notícia, preservados em 14/10, sem fingir acesso novo. Ambas as reportagens citam Semana 7. IDs, atos, revisões e estado de envios inalterados; o teste real não aplicou na base. Na fotografia vigente, a seleção normal retornou zero pendências dessas rotas porque os casos antigos já possuíam texto: não foram reprocessados. Novos casos serão tratados pela rotina diária, sem alerta automático por essa recuperação. O teste não prova acesso irrestrito ao Semana 7/Câmara nem cobertura de todos os documentos futuros.

## Rotas públicas alternativas — 16/10/2026

- Pedido: testar no GitHub Actions as alternativas de Semana 7/Guanhães e integrar as úteis, sem duplicar nem reenviar registros antigos. Diagnóstico real [38925009128](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38925009128): RSS do Semana 7 abriu com 50 entradas, sem corpo integral; sitemap deu HTTP 403; APIs municipais de legislação/diário abriram vazias; exportação pública do PortalTP retornou 559 decretos e o PDF oficial vinculado respondeu HTTP 206 com assinatura PDF válida. Nenhuma menção a consórcio no inventário examinado. Acesso a um PDF não prova disponibilidade de todos.
- Implementação: adaptadores `semana7-rss` e `guanhaes-portaltp` no coletor web, ativados **somente para descoberta**. PortalTP usa o próprio formulário público GET/POST, sem login, cookies transferidos ou CAPTCHA. Filtra links PDF do armazenamento oficial observado. Demais rotas não ativadas.
- Novidade/deduplicação: marco inicial `2026-10-16T15:40:00Z`, janela normal da coleta, filtro temático e URLs canônicas já presentes em `url`, `article_url` e `article_resolved_url` do acervo. Mesmo URL não entra duas vezes na passagem; falha de leitura do histórico bloqueia a rota. Não se fez carga retroativa. Cópias em URLs diferentes ainda dependem da triagem/deduplicação de episódios existente: não presumir que normalizar URL resolve todo plágio/republicação.
- Prova e alertas: RSS/ementa não ganham identidade de consórcio, data de vigência ou status de fato confirmado por serem publicados. Campo temporal do PortalTP é disponibilização, não data do ato. As novas fontes ficam sem alertas, inclusive no semanal, até homologação da leitura integral; decisão antiga/IA não elimina esse bloqueio. Continuam úteis para descobrir links e alimentar a recuperação/revisão existente, que não garante ler todo PDF automaticamente.
- Limites: PortalTP é Prefeitura e cobre decretos; não substitui as leis da Câmara de Guanhães. O RSS tem apenas as últimas 50 entradas e resumos, portanto não garante cobertura entre rodadas. O bloqueio dos artigos e da Câmara precisa ser distinguido do funcionamento dessas rotas alternativas. Não afirmar que o HTTP 403 foi eliminado.
- Validação local: 330 testes passaram, incluindo ausência de reenvio no boletim, respostas inválidas/403, datas, backlog e URLs repetidas. Coletores reais consultados em duas passagens: 50 itens RSS e 554 links PDF aceitos pelo validador de destinos, zero novos documentos temáticos. Verificador preservou IDs, atos, revisões, evidências revisadas e estado de envios. Workflow `test-public-routes.yml` é manual, somente leitura, sem segredos de WhatsApp/DeepSeek; gera relatório e exercita os mesmos coletores da produção.
- **Validação final no Actions:** [38925816525](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38925816525), commit `73d407a`, passou 330 testes e as duas passagens dos coletores, com zero novos documentos temáticos/zero elegíveis para envio. Verificação de segurança confirmou histórico e estado inalterados. O artigo integral do Semana 7 retornou 403; desta vez o índice de sitemaps abriu (21 referências), mas o sitemap de notícias apontado por ele retornou 403. Portanto, acesso ao índice é intermitente e não torna essa rota utilizável. RSS e PortalTP funcionaram nas duas execuções; não foram enviados WhatsApps por esses testes.

## Ponto de retomada — 16/10/2026

### Complemento: recuperação resiliente de Semana 7 e Guanhães

- **Pedido:** corrigir o acesso futuro, testar no Actions e não duplicar nem reenviar antigos. A recuperação agora independe da revisão editorial, preservando trecho lacrado, etapa, categoria e histórico de envio em revisados/enviados. Corpos recuperados ficam em `textos-artigos.ndjson`; nenhuma chamada ao WhatsApp ou à IA nesta manutenção.
- **Bug real do Semana 7:** o HTML continha a matéria e um script passivo do Cloudflare no rodapé. A detecção antiga tratava qualquer `challenge-platform` como bloqueio. Agora distingue artigo legível de desafio efetivo; não executa nem resolve CAPTCHA. Recuperados automaticamente no computador local 2.060 caracteres pelo Readability. Segue duplicata do mesmo atendimento CISGA, sem fato novo.
- **Rede:** prioridade IPv4 e uma repetição limitada para falhas transitórias. Não afirmar que IPv6 era a única causa. HTTP 403/CAPTCHA não recebe repetição imediata. `Retry-After` longo/data não é encurtado para insistir cedo dentro da rodada. Destinos já resolvidos são guardados, evitando repetir a resolução Google.
- **Fila:** falhas HTML não expiram após três tentativas; próxima tentativa registrada com intervalo crescente de 12h, 24h, 48h, 96h e até 7 dias. Processamento por tentativa mais antiga, até três itens por fonte/host por passagem, sequencial, orçamento de 90s para iniciar leituras (a leitura em andamento pode concluir depois). Não tentados por falta de orçamento não ganham falsa falha/sucesso. Leis sem palavra consórcio no título continuam na fila quando já tentadas. PDF/não-HTML ficam para sua rotina específica. Horário diário e limite global do workflow mantidos.
- **Actions real:** execução [38922350982](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38922350982), commit `3d999cc`, passou 319 testes e a comparação dos IDs, atos, revisões, provas e estado de envios. Porém os dois portais responderam **HTTP 403 no runner**. Sucesso do workflow não significa sucesso de acesso a essas fontes. O resultado local do Semana 7 foi salvo depois, sem alterar sua decisão.
- **Guanhães assistido:** usuário resolveu a verificação no navegador. Baixado pela interface o PDF oficial de 17 páginas da Lei 3.108/2022, incluindo protocolo até cláusula 17 e quadro final. Extração com pypdf: 44.933 caracteres após normalização/ocultação de CPFs, marcados por página, hash do texto e do PDF. Páginas 1 e 14–16 conferidas visualmente; texto das 17 extraído. Leitor `pypdf_navegador_assistido`, status `recuperado_assistido`, limitação HTTP 403 explicitada. Não exportados cookies, não declarada solução autônoma para novos casos. Mantida ratificação histórica, sem criar adesões, rateios ou consórcio a partir de cláusulas hipotéticas. A geração do PDF em 16/10/2026 não altera a data da lei de 2022.
- **Segurança e idempotência:** workflow não recebe sessão/segredo de WhatsApp. Um verificador compara estado antes/depois e impede persistência se IDs, atos, revisões ou envios mudarem. Repetir os dois IDs já recuperados selecionou zero documentos. Mantidos 1.946 documentos, 7 atos individualizados, 105 fatos confirmados e 72 envios históricos. 225 corpos integrais armazenados (eram 223). Suite local final com 322 testes; pacote público validado. A segunda execução no Actions verifica a versão final e a não repetição de textos já salvos.
- **Validação final no GitHub:** [38923393137](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38923393137), commit `f99e769`: 322 testes aprovados, zero falhas; os dois IDs já armazenados geraram zero tentativas e nenhuma mudança de base. Verificador confirmou IDs, atos, prova revisada, revisões e envios inalterados. Deploy [38923393918](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38923393918) bem-sucedido; JSON público consultado às 15h22 UTC mantém 105 confirmados e 72 envios, sem publicar corpos integrais.
- **Limite ainda existente:** o acesso futuro sem intervenção a Guanhães e ao Semana 7 a partir do GitHub não está liberado. A fila tenta novamente sem apagar o registro. Solução contínua, caso o bloqueio persista, depende de endpoint/feed oficial acessível ou autorização do portal para o coletor; não prometer 100% de leitura nem usar proxies/CAPTCHA automáticos. Os dois documentos específicos já estão preservados.

### Complemento: sete publicações sem texto revisadas

- **Escopo:** os sete documentos restantes da fotografia anterior, sem disparar coleta nem envio de WhatsApp. Resultado: duas inclusões (CIM-AMFRI e lei histórica de Guanhães), duas duplicatas (Lei 5.651/CEMMIL e atendimento CISGA), dois descartes (recrutamento CEMMIL e notícia Progov sem fato sobre consórcio) e uma edição do TCE-MG dividida em cinco atos de controle. São sete fatos novos, não sete novas publicações.
- **Decisão explícita do usuário:** acompanhamento técnico de fiscalização pelo CIM-AMFRI entra como ATUAÇÃO. A nota confirma cumprimento de intimação do MPSC, mas nega coordenação da operação. Não atribuir ao consórcio o descarte de alimentos, nem inventar sanção contra ele. Texto da nota recuperado em reprodução do Camboriu.com.br e comparado à página original do Página 3 pela pesquisa web; origem alternativa documentada.
- **Guanhães:** Lei 3.108/2022 ratifica protocolo do CIS-URG Médio Piracicaba. Artigos 1º–5º recuperados pela pesquisa web em fonte oficial, com cópia do corpo legal no registro da revisão; anexo não recuperado integralmente. Acesso HTTP local falhou e o SAPL teve falhas de DNS/502. Registro histórico em 2022, nunca alerta de 2026; não inferir ingresso original, data final de constituição, início do serviço ou usar CNPJ municipal como CNPJ do consórcio.
- **Duplicatas:** a Lei 5.651/2026 já era o registro `d86bf9a8…`; o novo URL `5b859e7b…` não duplica a ratificação estatutária. Semana 7 (`0783e43a…`) reproduz o atendimento CISGA já registrado em `a229b70e…`: mesmos 100 pacientes, YAG Laser, CDCO e quatro municípios. Página original conferida via pesquisa web; HTTP local continuou falhando. Guardada síntese editorial e vínculo, sem fingir recuperação integral automática.
- **TCE-MG, Diário de 15/10/2026, 27 páginas:** PDF baixado do tribunal, texto extraído e páginas relevantes conferidas visualmente. Processo 1207977/ICISMEP (p. 2): arquivamento após licitação fracassada, sem mérito. 1160650/Ponte Nova–CIMVALPI (pp. 4–6): contrato de programa considerado regular; multas de outros apontamentos não foram atribuídas ao consórcio, que figura como interessado. 1217718/CNIF e 1217658/CIMCENTRAL (p. 6): extinção sem julgamento de mérito após revogação/anulação; não condenações. 1214503/CIMARG (pp. 6–7): suspensão cautelar dos efeitos da ata referendada, não decisão definitiva nem paralisação do consórcio. Menções a oficinas nas pp. 20–21 são designações de instrutores, não outro fato institucional. Individualização editorial deste PDF, não segmentação automática universal.
- **Código melhorado:** recuperação de texto não exige palavra “consórcio”; pertinência é decidida depois. Ementas individualizadas com partes, relator, MPTC, sessão e resultado passam como CONTROLE; edições com múltiplos processos não acionam essa regra. A nota de acompanhamento técnico não vira controle contra o consórcio. Páginas de prova são filtradas também pela chave do ato, evitando misturar processos na mesma página. Links dos atos apontam ao PDF original, não à URL intermediária do Google. Data original comprovada permite conservar lei histórica na base, com bloqueio de alerta retroativo.
- **Fotografia final deste complemento:** 1.946 publicações, 7 atos individualizados (antes 2), 105 confirmados (antes 98), 66 identidades extraídas/candidatas, 223 textos integrais armazenados e 197 revisões lacradas. Zero pendências de classificação, identidade, sugestões e brutos sem texto **e sem revisão**. Isso não significa texto integral de todos: Guanhães tem leitura parcial da norma e Semana 7 tem conferência web documentada. Os 72 envios históricos ficaram intocados.
- **Validação:** 309 testes aprovados, sintaxe e pacote público (8,07 MB) validados. Novos testes usam os atos e notícias reais, cobrem duplicatas, isolamento de páginas e lei antiga preservada sem alerta. A revisão da IA não pode transformar acompanhamento técnico ou decisão de controle delimitada em crise. Nenhuma chamada real de IA nem envio de WhatsApp feito nesta intervenção. Limite restante: acessibilidade automatizada dos dois portais e recuperação integral do anexo de Guanhães; não confundir revisão documental concluída com acesso automático resolvido.

### Intervenção anterior: crises e contratos rotineiros

- **Decisão explícita do usuário:** descartar contratos rotineiros com fornecedores, inclusive credenciamentos assistenciais já firmados. Isso não exclui contratos de rateio entre município e consórcio. A contratação de consultoria para prestar contas não comprova que as contas foram prestadas.
- **Lote de 12 registros revisado:** 8 fatos confirmados com etapa limitada à prova; 4 descartes. CISVARC 124, 125 e 126/2026 são credenciamentos rotineiros, não crises. A dispensa de consultoria do CISMNORTE também ficou fora. As hipóteses contratuais de falência da empresa, sanção e retirada de ordem não são acontecimentos do consórcio.
- **Fatos aproveitados:** aditivo de rateio Castro/CIMSAMU; assembleia e visita técnica realizadas pelo CONIAPE (não inauguração); votação de projeto de protocolo em Lagoa da Prata (não sanção); aditivo de rateio Cláudia/Vale do Teles Pires; alteração contratual e delegação do SIM de São Félix/CIDESAA; ingresso apenas autorizado de São Félix/CIDESA-NA; repasse apenas autorizado de São Félix/CISA; multas aplicadas ao ex-presidente do CORIPA pelo TCE-PR. Não juntar CIDESAA e CIDESA-NA por semelhança de sigla.
- **Datas e evidências:** Castro conferido no PDF original da prefeitura, edição 3495, páginas 4–5, com extração textual e verificação visual. O espelho Querido Diário falhou por TLS local, não o original. A notícia TCE-PR é de 26/05/2016; a votação de Lagoa da Prata ocorreu em março de 2024. No segundo caso, publicação original desconhecida fica vazia; a indexação de 2026 não vira data de publicação. Os textos recuperados ficam separados dos trechos lacrados. 185 revisões têm vínculo por hash ao trecho observado.
- **Proteções de regra:** analisar cada ocorrência e seu contexto, evitando que uma cláusula hipotética domine o texto; manter crise, saída e fiscalização efetivamente ocorridas. Aditivo de rateio, autorização de ingresso/repasse, votação de projeto e assembleia realizada recebem etapas próprias. Índice de notícias do CONIAPE serve para descoberta, não vira fato pela mistura de notícias. Recuperação e releitura usam o mesmo filtro de sugestões.
- **IA:** prompt v5 explicita essas distinções. Reprocessamento histórico preserva rejeições anteriores da IA; atualizar o prompt não pode ressuscitar descartes. A fila de alertas continua exigindo revisão na versão vigente. Testes da integração são simulados, sem chamada adicional paga à API nesta revisão.
- **Fotografia do lote antes da coleta concorrente:** 1.933 publicações e 2 atos; confirmados 90 → 98; pendentes de decisão 12 → 0; sugestões de releitura 4 → 0; pendências de identidade 2 → 0. Identidades extraídas/candidatas 56 → 60, não equivalentes a CNPJs homologados. Os 71 envios históricos foram preservados. Cinco documentos brutos sem texto/revisão permanecem fora desse lote, sem descarte artificial por falha de acesso.
- **Validação:** 296 testes passaram, incluindo os 12 textos reais, variações de nomes/números, verdadeiros positivos e proteção contra reabertura histórica. Comparação automática em 217 textos integrais apontou 14 mudanças de categoria/etapa, verificadas na revisão; não significa leitura humana de todo o acervo. Nenhum envio retroativo ou teste de WhatsApp foi acionado. A geração pública e seu verificador são testados separadamente; inspeção visual do painel local foi bloqueada pela política do navegador, portanto não declarar essa validação como realizada.
- **Coleta concorrente incorporada (16/10, 10h57 de Brasília):** mais 13 documentos, incluindo reportagem do Fatos de Mato Grosso sobre o mesmo credenciamento de próteses do CISVARC. Foi enviada pelo código anterior durante a revisão. Também descartada por escopo, sem apagar o envio. A regra passou a reconhecer notícias de credenciamento privado com atendimento apenas previsto, preservando relatos de entregas e sanções efetivamente ocorridas. Total final: 1.946 publicações, 2 atos, 98 confirmados, zero pendências de decisão, zero sugestões de releitura e zero pendências de identidade; 72 envios históricos, 219 textos integrais e 186 revisões lacradas. O lote original foi 8 aceitos/4 descartados; com essa notícia adicional, 8 aceitos/5 descartados. Suite final: 297 testes aprovados; pacote público validado.
- **Próximos limites:** ampliar a amostra de fornecedores e outros estilos de cabeçalho, recuperar os sete brutos sem texto/revisão (cinco anteriores e dois da coleta concorrente) e continuar segmentando atos em diários. Regressões reduzem os erros conhecidos, não garantem acerto universal em textos futuros. Agenda, grupo e cotas não foram alterados.

## Ponto de retomada — 14/10/2026

- **Ordenação do painel corrigida após validação visual do usuário:** Triagem e Publicações agora ordenam pela primeira coleta (mais recente primeiro), não pela última redescoberta. Na mesma coleta, desempate pela publicação e ID; primeira coleta ausente não é inventada. Listas e fichas distinguem “Coletado em”/“Primeira coleta” de “Publicado em”; última leitura continua nos detalhes. Antes, documentos de 09/10 reencontrados em 14/10 ficavam no topo e pareciam indicar coleta parada. A data global da última execução permanece independente da ordenação. 273 testes passaram; não houve alteração de decisões, coleta ou WhatsApp nesta correção.
- **Complemento após resposta do usuário, às 14h20 de Brasília:** AMM-MT autorizada para alertas novos (`publish:true`). Corte conservador `alertsFrom:2026-10-14T17:20:22.000Z`: só publicações posteriores a esse instante podem alertar. Itens anteriores continuam na base, sem liberar o acervo de prévias. Sem data original válida, o alerta fica bloqueado. A verificação vale também para a fila e para itens confirmados editorialmente; preservados revisão DeepSeek, deduplicação, cron, grupo e cotas. A data diária sem horário pode excluir publicações do próprio dia da ativação, intencionalmente para evitar retroatividade.
- **Córrego Fundo resolvido com contribuição humana:** usuário colou a página do PL 1129/2026. Corpo preservado com hash e leitor `texto_fornecido_pelo_usuario`; não declarar recuperação automática nem CAPTCHA resolvido. O projeto está em tramitação. Aceito em GOVERNANÇA somente o antecedente que seu art. 1º relata: alteração contratual do CICANASTRA aprovada em assembleias de 2025/2026. A ratificação municipal e a mudança do mandato seguem como propostas, sem sanção/vigência comprovadas. Atas e anexos não foram consultados. Não inferir ingresso ou aproveitar o CNPJ da Câmara para o consórcio. Registro histórico, sem alerta. A página é de 01/06/2026, não da indexação de outubro nem da atualização do rodapé.
- **Proteções adicionais:** teste distingue fórmula “APROVOU E SANCIONO” na minuta de aprovação real; nome completo conferido do CICANASTRA não é cortado na vírgula; painel dá prioridade à data original armazenada sobre indexação do Google.
- **Fotografia após este complemento:** 1.763 publicações, 2 atos, 90 fatos confirmados, 53 identidades candidatas, zero candidatos aguardando decisão, zero pendências de identidade no contador e zero brutos sem texto e sem revisão. Isso não significa que todos os documentos têm corpo integral: há descartes fundamentados apenas no título e acessos automáticos ainda bloqueados. Abaixo permanece o histórico da intervenção anterior à resposta.
- **Validação do complemento:** 270 testes passaram, inclusive bloqueio de publicações anteriores à ativação na fila, data original no painel e distinção entre minuta e deliberação relatada. Sintaxe e pacote público aprovados. Não houve chamada real adicional à IA nem envio de WhatsApp nesta validação.

### Intervenção anterior à autorização da AMM-MT

- **Decisão do usuário:** incluir orientações gerais aplicáveis aos consórcios públicos, mesmo sem entidade específica. O primeiro caso é a orientação tributária CNM/Cosit 145/2026, conferida na reprodução da AMA-AL porque o portal CNM bloqueou acesso. Categoria FINANÇAS, abrangência nacional e identidade não aplicável; não inventar consórcio, CNPJ, município ou UF do fato a partir do estado do veículo. Não é validação jurídica independente do inteiro teor da Cosit.
- **Revisão de 13 registros-alvo:** 12 decisões documentadas; 1 conteúdo ainda inacessível (CAPTCHA). Cinco fatos adicionados: estatuto do CIDESAPA ratificado em Pontal do Araguaia; rateio de Campo Verde/CIDESASUL; orientação CNM; contas de 2024 do CISVAP desaprovadas (não duplicar com julgamento de 2023); procedimentos oftalmológicos executados pelo CISGA. A portaria de fiscal do CIDESASUL foi vinculada ao rateio como documento complementar, sem outro evento. A reprodução ABC–Metodista foi vinculada ao episódio existente. Dois recrutamentos foram excluídos pelo título, com corpo inacessível explicitado. O contrato solar municipal do RN ficou fora, conforme regra de compras por ata. Lajedão (PDF p. 52) é rubrica de orçamento; Salto (PDF p. 2) apenas retifica horário de assembleia futura. PDFs conferidos textualmente e visualmente.
- **Números após reprocessamento do acervo até a coleta das 11h31 de 14/10:** 1.763 publicações, 2 atos, 89 fatos confirmados (antes 84), zero candidatos ativos aguardando decisão e zero pendências de identidade no contador de publicações aproveitáveis. Resta 1 bruto sem texto e sem revisão. Os zeros não significam cobertura universal nem ausência de futuros casos difíceis.
- **Identidades:** 52 identidades extraídas/candidatas, 5 com CNPJ associado e 4 relações município–consórcio documentadas. Foi corrigido corte na vírgula de “Econômico, Social e Ambiental”, que juntava entidades diferentes. CIDESAPA e CIDESASUL agora têm IDs distintos; CNPJ 08.051.612/0001-15 pertence à evidência do CIDESASUL. O CNPJ foi conferido no extrato e pelo dígito verificador, não homologado na Receita. O contador deixou de apontar identidade incompleta para registros descartados. Identidade candidata não equivale a CNPJ ou cadastro institucional validado externamente.
- **Texto integral:** as novas leituras HTML passam a ser persistidas antes de o histórico da rodada reduzir o resumo. A primeira versão integral é preservada, com hash e redação de identificadores pessoais básicos; não é sobrescrita por resposta posterior curta. Foram recuperados 19 textos integrais nesta intervenção, incluindo atos antigos da amostra AMM. O pacote público do painel não inclui texto integral. Mudanças posteriores no mesmo URL ainda exigem futura política de versionamento/revisão; esta correção não resolve esse caso.
- **Regras ajustadas:** portaria de fiscal não anuncia rateio novo; extrato com partes e assinatura mantém essa etapa; “reprovou as contas” identifica controle; procedimentos viabilizados pelo consórcio identificam atuação; norma sanitária não vira punição ao consórcio; lei de crédito em rubrica genérica não vira contrato; “fica ratificado, no âmbito..., o Estatuto” prevalece sobre palavras incidentais. DeepSeek passou ao prompt v4, admite FINANÇAS/orientação geral e mantém exigência de evidência literal. O teste do contrato da API usa respostas simuladas; nenhuma chamada real adicional foi feita nesta intervenção.
- **AMM-MT:** amostra dirigida dos 17 documentos já decididos, consultados novamente. Primeira tentativa: 16 corpos recuperados, 13 categorias coincidentes; nova consulta recuperou 17 e mostrou três falhas de regra. Após correções: 17/17 corpos e categorias coincidentes. Isso é regressão em amostra conhecida, não prova de 100% em notícias inéditas. `publish:false` permanece até resposta do usuário sobre ativação de alertas novos; coleta e registro na base continuam.
- **Validação:** 266 testes passaram; checagem sintática, geração do painel público e verificador de publicação passaram. Painel local aberto e conferido. As cinco inclusões têm `publicar:false`; nenhum envio retroativo ou teste de WhatsApp foi feito.
- **Pendências:** usuário foi consultado sobre habilitar AMM-MT para alertas e sobre fornecer o conteúdo do [PL 1129/2026 de Córrego Fundo](https://www.corregofundo.mg.leg.br/proposicoes/Projetos-de-Lei-Ordinaria/2026/1/0/469). Não tratar CAPTCHA como prova de irrelevância. Manter segmentação de atos em PDFs, versionamento de textos e generalização das regras como dívidas de qualidade. Cron/grupo/cotas não alterados.

## Fotografia anterior — 13/10/2026

- **Objetivo:** transformar publicações de fontes públicas em fatos rastreáveis sobre consórcios, preservando rejeições e incertezas; separar a decisão da base da decisão de enviar uma mensagem. O painel é uma consulta pública de pesquisa, não um cadastro oficial nem uma base homologada pelo Ipea.
- **Operação vigente:** repositório público; coleta solicitada a cada 2 horas no minuto 17 de Brasília; resumo semanal no sábado às 9h, com retentativa às 12h se não houve confirmação. O GitHub pode atrasar ou omitir cron. O destino de homologação continua sendo o grupo de teste até uma decisão específica de troca.
- **Fotografia da base publicada:** 1.684 publicações arquivadas, 2 atos individualizados dentro de um PDF, 84 fatos confirmados por revisão, 45 identidades candidatas e 3 relações município–consórcio documentadas. São contagens de 13/10, não totais permanentes; conferir o [painel vivo](https://driano1221.github.io/radar-consorcios-whatsapp/) antes de citá-las em outra data.
- **Ato não é edição:** o Diário de Joinville de 09/10 permanece uma publicação, mas ganhou dois atos com IDs, páginas, trechos e decisões próprias. A compra municipal da página 95 foi descartada como fato do radar; o apostilamento do rateio nas páginas 159–160 foi aceito. A edição inteira está bloqueada para alerta. A individualização atual é um piloto editorial, não segmentação automática de todos os diários.
- **Validação mais recente:** 257 testes passaram; o deploy do painel após a correção do alerta da edição [terminou com sucesso](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38428900074), e o `data.json` publicado mostrou os dois atos e a edição como `desdobrado`/`historico`. Nenhum envio ao WhatsApp foi feito para validar essa alteração.
- **Dívida prioritária:** reconhecer atos novos em PDFs com limites de página e prova confiáveis, sem atribuir o trecho de outro ato; continuar eliminando candidatos por evidência e regressão, nunca só por troca de rótulo.

## Contexto

O radar foi criado para apoiar um projeto do Ipea sobre avanços e limites da coordenação federativa por meio de consórcios intermunicipais, com atenção especial a dificuldades de adesão, permanência, financiamento, governança e continuidade institucional.

O objetivo do piloto é entregar, em um grupo do WhatsApp, notícias curtas e úteis sobre:

- criação e dissolução de consórcios;
- entrada e saída de municípios;
- protocolos de intenções;
- contratos de rateio;
- crise financeira, inadimplência ou paralisação;
- governança, controle e fiscalização;
- mudanças relevantes na atuação dos consórcios.

## Decisões principais

### Infraestrutura

- GitHub Actions foi escolhido para evitar servidor, n8n e mensalidade.
- O repositório é privado.
- O workflow roda uma vez por hora, no minuto 17, com fuso `America/Sao_Paulo`.
- Cada job tem limite de dois minutos.
- O orçamento do Actions está em US$ 0 com bloqueio de cobrança adicional.

### WhatsApp

- Foi usado o número pessoal do participante.
- A homologação ocorre exclusivamente no grupo **Radar Consórcios - Teste**.
- A conexão usa Baileys 6.7.24, versão estável e mais leve que alternativas baseadas em Chromium.
- A sessão é cifrada com AES-256-GCM antes de entrar no Git.
- O ID do grupo e a senha da sessão existem somente como secrets ou arquivos locais ignorados.

### Conteúdo

- Limite atual: 3 mensagens por rodada e 72 por dia.
- Janela de coleta: 96 horas.
- Histórico de notícias enviadas: 365 dias.
- Ordenação: maior pontuação primeiro; em empate, publicação mais recente.
- Categorias atuais: criação, adesão, saída, crise, controle, rateio, finanças, protocolo, governança e atuação.
- Notícias empresariais, comerciais e compras por ata de preços são penalizadas.

### Fontes

- Google News RSS com 19 consultas específicas.
- Querido Diário em três grupos de busca.
- COPIRN.
- Observatório das Metrópoles.
- Frente Nacional de Prefeitas e Prefeitos.
- Agência Brasil.
- Scrapers em prévia da RNCP, CNM e TCE-MG.
- Monitoramento experimental do índice da edição mais recente da AMM-MG.

PNCP, Transferegov e GDELT foram avaliados, mas não entraram no disparo inicial devido a ruído ou instabilidade. Podem ser usados futuramente em uma camada analítica.

### IA e agentes

- O projeto não foi transformado em agente autônomo durante o piloto.
- A coleta e a publicação permanecem determinísticas para reduzir custo, alucinação e risco editorial.
- Uma API de IA poderá ser adicionada posteriormente apenas como revisora e redatora dos candidatos já selecionados.
- O modelo não deverá pesquisar e publicar sozinho nem substituir a fonte original.

## Deduplicação atual

A proteção combina URL canônica, título normalizado, impressão digital do título, categoria e similaridade Jaccard dos termos significativos do conteúdo. A comparação ocorre tanto contra o histórico persistente quanto entre itens da mesma rodada.

Somente mensagens efetivamente entregues são marcadas. O registro acontece imediatamente depois de cada envio e é persistido pelo workflow.

Risco residual: uma notícia completamente reescrita e classificada em outra categoria pode escapar. A melhoria planejada é criar uma identidade institucional baseada em município, consórcio, evento, número do ato e data.

## Comportamento quando existem mais de três notícias

Não existe fila persistente na versão inicial. As três melhores são enviadas e as restantes não são marcadas. Elas voltam a concorrer nas horas seguintes se continuarem presentes nas fontes e dentro da janela de 96 horas.

A fila persistente é a primeira melhoria estrutural prevista após a homologação. Cada registro deverá conter:

- identidade do acontecimento;
- fonte e URL original;
- data de descoberta e publicação;
- prioridade;
- tentativas de envio;
- situação: pendente, enviado, descartado ou expirado;
- motivo do descarte ou expiração.

## Validações realizadas

- 27 testes automatizados aprovados.
- Verificação sintática aprovada.
- Auditoria das dependências sem vulnerabilidades conhecidas.
- Sessão do WhatsApp verificada localmente.
- Mensagem diagnóstica enviada ao grupo de teste.
- Coleta ampliada encontrou dezenas de publicações e reteve somente os candidatos relevantes.
- Primeira execução do GitHub Actions sem envio concluída com sucesso.
- Primeira execução real do GitHub Actions concluída com sucesso.
- Três notícias foram enviadas nessa rodada: governança em Costa Rica/MS, rateio em Contagem/MG e adesão em Itápolis/SP.
- O estado remoto confirmou a gravação das três entregas e a renovação da sessão cifrada.

## Homologação até domingo, 16 de agosto de 2026

Não alterar regras durante o período, salvo erro grave. Observar e registrar:

1. notícia útil ou inútil;
2. falso positivo;
3. duplicidade;
4. resumo confuso ou mal formatado;
5. publicação muito antiga;
6. volume excessivo ou insuficiente;
7. falha do Actions ou desconexão do WhatsApp;
8. notícia que permaneceu várias rodadas sem aparecer.

## Roteiro posterior, em ordem sugerida

1. Revisar as ocorrências reais do piloto.
2. Implementar fila persistente.
3. Criar identidade institucional para deduplicação.
4. Adicionar alerta de falha do workflow ou da sessão do WhatsApp.
5. Produzir boletim diário ou semanal consolidado.
6. Avaliar IA para resumo, justificativa de relevância e extração estruturada.
7. Criar painel histórico de consórcios, municípios e eventos.
8. Somente depois substituir o grupo de teste pelo grupo definitivo.

## Fase de scraping — 17 de agosto de 2026

- Scrapers leves foram inicialmente implementados apenas em prévia. Depois da homologação do TCE-MG, a publicação passou a ser configurada por portal: somente o TCE-MG está marcado com `publish: true`; AMM-MG e futuras fontes continuam em prévia.
- Cada portal possui parser isolado, timeout, uma nova tentativa, `User-Agent` identificável e detecção básica de mudança de layout.
- A primeira coleta real dos scrapers observou três itens dentro da janela: duas notícias do TCE-MG e o índice da edição da AMM-MG.
- Uma notícia do TCE-MG sobre suspensão de licitação do Ciminas atingiu 11 pontos e foi corretamente retida como candidato de CONTROLE em prévia.
- A outra notícia do TCE-MG, sem relação com consórcios, foi descartada pelo classificador.
- RNCP e CNM estavam acessíveis, mas não tinham item dentro das 96 horas da coleta.
- O Diário Municipal não é pesquisado por formulário porque existe CAPTCHA; o radar não tenta contorná-lo. O protótipo apenas monitora a edição e não trata um PDF inteiro como notícia.
- Saídas de auditoria: `output/scraper-observations.json`, `output/scraper-candidates.json`, `output/scraper-health.json` e `output/scraper-preview.txt`.
- A ativação por portal evita que a aprovação do TCE-MG libere automaticamente AMM-MG ou qualquer fonte futura. A observação agora é feita sobre os envios reais originados exclusivamente no TCE-MG.
- A primeira execução no GitHub Actions após o merge terminou com sucesso em 22 segundos. TCE-MG e AMM-MG funcionaram; RNCP e CNM responderam `403` apenas no ambiente do GitHub.
- Para respeitar as proteções dos portais, as chamadas diretas de RNCP e CNM foram desativadas no Actions e substituídas por consultas específicas no Google News. Nenhum mecanismo de contorno foi adotado.

## Arquivos centrais

- `src/radar.mjs`: orquestra coleta, seleção, envio e persistência.
- `src/lib/classifier.mjs`: classificação e pontuação.
- `src/lib/dedupe.mjs`: deduplicação e histórico.
- `src/lib/format.mjs`: apresentação das mensagens.

## Incidente e recuperação — 14 de setembro de 2026

- A sessão vinculada do WhatsApp foi revogada. Entre as execuções #359 e #382, um candidato do TCE-MG foi reencontrado, mas o envio falhou em todas as tentativas.
- As execuções seguintes ficaram verdes porque o candidato saiu da janela de 96 horas e, sem candidato, a versão anterior não abria conexão com o WhatsApp.
- A sessão foi pareada novamente e validada no grupo `Radar Consórcios - Teste`.
- Foi criada uma fila persistente de 30 dias. Candidatos passam a ser gravados antes da tentativa e só são removidos após confirmação de entrega.
- Foi adicionada verificação da sessão a cada 24 horas, inclusive quando não houver notícia nova.
- `src/lib/whatsapp.mjs`: conexão e entrega.
- `src/lib/sources/web-scrapers.mjs`: adaptadores de scraping e normalização.
- `config/default.json`: limites e parâmetros editoriais.
- `.github/workflows/radar.yml`: agendamento e execução no GitHub.
- `docs/ARQUITETURA.md`: pesquisa técnica e justificativas.

## Operação segura

- Para pausar: definir `SEND_ENABLED=false`.
- Para trocar de grupo: atualizar apenas o secret `WHATSAPP_GROUP_ID` depois da homologação.
- Nunca incluir no Git o conteúdo de `.local/`, o número pessoal, a senha ou o ID do grupo.
- Se a sessão cair: parear novamente, preparar a sessão cifrada e atualizar somente `state/auth.enc` e `state/auth.sha256`.
# Memória adicional — ampliação de 14/09/2026

O usuário autorizou pesquisa, depuração, expansão, melhorias de mensagem, alertas e resumo semanal de sábado. A implementação mantém Node.js, GitHub Actions e grupo de teste. Não presume autorização para trocar o destino pelo grupo dos chefes sem identificar esse grupo.

Decisões: janela de descoberta 168h; sábado 09h BRT, fallback 12h com idempotência por semana/destino; histórico de descobertas 60 dias; QD em `https://queridodiario.ok.org.br/api`; alerta externo à sessão via GitHub Issues. QD retornou dados e também erros 503/timeouts no mesmo dia. RNCP voltou a funcionar. TCE-SP, CISAMAPI, CONIAPE, CIGA, CISREC e duas instâncias SAPL foram integrados. Nem todos têm notícias recentes ou alto rendimento.

Casos críticos encontrados: Valinhos apresentava proposta de ingresso, não adesão efetivada; tabelas de despesa com pessoal não são novos contratos; OCR não deve produzir siglas inventadas; menção a TCE em podcast não equivale a fiscalização. Esses casos ganharam regressões. Pesquisa completa e limites estão em `docs/PESQUISA_E_VALIDACAO_2026-09-14.md`.

Correção após validação remota: RNCP e CISAMAPI retornaram HTTP 403 no Actions, apesar do sucesso local. Os adaptadores foram mantidos, mas desativados em produção; foram preservadas/adicionadas buscas Google específicas. As seis novas interfaces diretas ativas são TCE-SP, RSS de CONIAPE/CIGA/CISREC e as duas instâncias SAPL. Não afirmar que todos os portais pesquisados estão operacionais no GitHub.

Produção validada em 14/09: execução 34890080312 enviou notícia do CONIAPE; 34890156509 enviou prévia do resumo; 34890287847 repetiu a solicitação e não reenviou. Histórico inicial real: 69 URLs únicas e um achado relevante, com QD indisponível nessa rodada. Suíte final: 54 testes. Primeiro sábado após implantação: 19/09/2026 às 09h BRT.

## Base histórica de consórcios — estado em 03/10/2026

Esta seção registra **desde a ideia de criar uma base**, e não apenas as últimas correções. A base transforma o material encontrado pelo radar em um catálogo rastreável, mas **não é um cadastro oficial nem uma relação confirmada de municípios consorciados**. Números abaixo são uma fotografia de 03/10/2026 e substituem contagens intermediárias da auditoria.

1. **Modelo e preservação:** separar documento coletado, hipótese de evento e identidade do consórcio. Guardar também achados não enviados ao WhatsApp. O arquivo bruto conserva fonte, URL, datas e trecho; `eventos.csv`, `consorcios.csv` e `vinculos-documentos.csv` são visões derivadas. Um documento pode mencionar mais de um consórcio, e um vínculo documental não prova adesão, saída, pagamento ou criação.
2. **Carga retroativa:** `npm run catalog:backfill` reconstituiu **1.148 documentos** a partir das versões de `state/news-state.json` preservadas no Git. Recupera apenas o que o radar já havia armazenado, não toda a internet nem textos integrais ausentes. A atualização corrente usa `npm run catalog:update` nas execuções persistentes do Actions. O catálogo fica em `data/catalogo/` como CSV/NDJSON versionado e `resumo.md` legível; não foi criado serviço pago de banco de dados.
3. **Identificação conservadora:** nomes, siglas e CNPJ são ligados ao documento apenas com evidência contextual; CNPJ precisa passar na validação e estar associado à entidade. Menção genérica, manchete truncada ou sigla ambígua ficam em `identidade-pendente.csv`, sem criar um consórcio por suposição. Identidades locais têm ID estável, mas esse ID não substitui o CNPJ.
4. **Auditoria dos candidatos:** entre os 1.148 documentos, **68** tinham sido classificados como possíveis eventos. Foram revistos por meio dos trechos disponíveis, páginas originais e PDFs recuperáveis; **isso não significa leitura integral dos 1.148 nem confirmação jurídica dos 68**. A auditoria recuperou trechos de PDFs com página, conferiu fontes complementares e registrou decisões editoriais com evidência e hash do trecho, para invalidá-las se a evidência mudar. Foram excluídos **18 falsos eventos** das visões derivadas, mantendo-os no arquivo bruto, e **4 categorias** foram corrigidas.
5. **Proteções do radar:** testes de regressão impedem que os 18 falsos eventos reapareçam na coleta, numa fila antiga ou no boletim semanal. A sigla ambígua `CISMESTR` de Rio Claro ficou pendente em vez de receber uma identidade arbitrária. Um projeto de lei de Guanhães de **2022**, reindexado em 2026, foi impedido de aparecer como notícia atual. Mensagens antigas já enviadas não são apagadas por essas correções.

**Fotografia atual:** 1.148 documentos arquivados; **50 possíveis eventos** após as exclusões; **26 identidades candidatas**; **40 vínculos documento–consórcio**, sendo 29 apoiados por fonte complementar conferida e 11 ainda automáticos; **11 documentos relevantes sem identidade segura**. Os 50 eventos, as 26 identidades e os 40 vínculos **não são fatos plenamente validados para uso analítico sem conferência adicional**. Datas de indexação/publicação não devem ser confundidas com data do ato ou de seu efeito jurídico.

**Exemplos que orientam a leitura:** a autorização para Campo Belo sair do CISMARG não prova retirada concluída; uma lei que autoriza Marília a ingressar no CONDESU não comprova ingresso efetivo; o documento de Salinas menciona CIMES e CISRUN e, por isso, pode ter dois vínculos; a extinção de uma locação do CIENSP não extingue o consórcio. A notícia de agenda setorial do Grande ABC é atuação de consórcio existente, não criação.

**Próximos passos da base, nesta ordem:** revisar documentalmente os 11 vínculos automáticos e os 11 documentos sem identidade segura (com OCR ou consulta ao ato quando necessário); conferir amostras e depois os demais vínculos apoiados por fonte complementar; criar uma camada temporal município–consórcio que diferencie proposta, autorização, ratificação e ingresso/saída efetivos com data, página e fonte; melhorar a identidade do mesmo evento entre URLs/fontes; somente então usar o cadastro para inferir composição histórica ou cruzar com análises do Ipea. Ver `data/catalogo/README.md` e `docs/AUDITORIA_IDENTIDADES_2026-10.md` para regras, evidências e ressalvas.

## Checagem operacional e correções — 05/10/2026

- O radar, a verificação da sessão e o resumo semanal concluíram as últimas execuções consultadas; a sessão encontrou o grupo de teste e o estado registrou o resumo de 03/10 como entregue. A base publicada havia crescido para 1.251 documentos. Isso não significa cobertura integral: o Querido Diário estava degradado em sete rodadas consecutivas; em 05/10 as três consultas expiraram, enquanto Google News, feeds e scrapers continuaram coletando. A AMM-MG teve um HTTP 503 isolado.
- O envio de 04/10 incluiu o título `14/03/2022 - LEI Nº559-2022`, reindexado pelo Google como se fosse notícia de 2026. A regra anterior só reconhecia atos cujo título começava diretamente por `Lei` ou `Projeto de Lei`. A correção aceita uma data do ato anteposta, reaplica a exclusão à fila e ao boletim e remove o item das tabelas derivadas do catálogo sem apagar o arquivo bruto ou o registro histórico do envio. Mensagem já entregue no WhatsApp não é retirada retroativamente.
- As consultas do Querido Diário passam a usar no máximo duas requisições simultâneas, timeout de 25 segundos e até duas retentativas. O objetivo é reduzir a pressão sobre a API pública e recuperar falhas transitórias; a eficácia depende de validação em execuções reais e não garante disponibilidade do serviço externo.
- A prévia sem envio [#502](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/37337396591), já com a correção, passou no Actions, mas o Querido Diário **continuou indisponível**: zero itens após aproximadamente 107 segundos, com timeout nas consultas. Google News, RSS e scrapers continuaram funcionando. Portanto a alteração melhora tolerância, mas **não resolveu a indisponibilidade externa observada**; não declarar cobertura do QD restaurada até uma coleta real voltar a trazer itens.
- Essa prévia revelou também que uma aprovação antiga da IA ainda podia elevar o item de 2022 a `relevante` no funil, apesar da rejeição determinística. A aplicação da revisão de IA e a reconstrução do catálogo passaram a respeitar a classificação atual; um parecer antigo não ressuscita item que hoje é `GERAL`. Há testes com o título real para ambos os caminhos.
- O cron continua configurado para cada duas horas, mas o GitHub Actions pode atrasar ou descartar execuções agendadas; isso não pode ser garantido por uma alteração no cron. A janela de busca de 168 horas permite recuperar achados quando a próxima coleta acontece dentro desse período. Para cadência estrita seria necessário um agendador externo.

## Painel de consulta — 05/10/2026

- Foi criada uma interface local, estática e somente de leitura em `dashboard/`, com visão geral, últimas coletas, pendências e identidades candidatas. Geração: `npm run dashboard:build`; acesso local: `npm run dashboard:serve`.
- O painel distingue arquivo bruto de base de eventos candidatos e usa as revisões editoriais das tabelas derivadas. A primeira prévia revelou uma divergência na exibição do caso Valinhos; foi corrigida para mostrar **proposta de adesão**, não adesão efetiva.
- As próximas execuções persistentes guardarão decisões individuais compactas em `state.decisions`, com motivo e situação da última rodada por URL (14 dias, até 1.500 itens). Para registros antigos, o motivo pode ser genérico porque o funil individual ainda não era persistido.
- Fotografia local após reprocessar a base: 1.251 documentos, 50 eventos candidatos, 26 identidades candidatas e 11 documentos relevantes sem identidade segura. Nenhum desses totais é comprovação jurídica automática.
- O usuário escolheu **não publicar ainda**. GitHub Pages não foi ativado, nem foi criado workflow de deploy. O painel permanece local e privado até nova decisão explícita sobre a exposição pública dos dados.
- A primeira versão ficou abstrata para o usuário. Em 05/10, a interface foi simplificada para três áreas — **Início, Publicações e Consórcios** —, com rótulos diretos (“possível achado”, “fora da lista”, “precisa conferir”), decisão em linguagem comum e detalhes técnicos recolhidos. A fila passou a ser o filtro “Precisam de conferência” dentro das publicações. A distinção entre proposta, autorização e adesão efetiva continua preservada.

## Painel e meta de triagem — 09/10/2026

- O usuário escolheu a direção visual **Registro**, rejeitando a janela XP. A triagem distingue acervo acumulado, documentos inéditos no dia e resultados/documentos inéditos na última execução. Resultado de fonte não equivale a novo documento.
- A ficha de Publicações põe decisão, motivo, evidência e WhatsApp em linguagem direta; demais dados continuam disponíveis em seção expansível. A Base mostra campos principais sem rolagem horizontal, mas preserva todos os campos na ficha da linha. Como funciona passou a localizar a IA no fluxo e a listar as fontes da configuração atual.
- **Objetivo futuro explícito:** quase toda publicação deve chegar a aceite ou descarte, com prova e justificativa. Candidatura e pendência são exceções temporárias. Trabalhar nos cinco candidatos e nos marcadores de identidade, prévia, divergência e nova pista; não reclassificar à força apenas para zerar contadores. Para cada regra corrigida, reprocessar o histórico e acrescentar regressão.
- O painel permanece **local e privado**. Nenhum GitHub Pages foi ativado.

## Publicação contínua do painel — 09/10/2026

- O usuário autorizou posteriormente colocar o painel online e exigiu que ele acompanhe as atualizações do GitHub. Essa decisão substitui a restrição anterior de não publicar. O repositório já estava público; a hospedagem escolhida é GitHub Pages, somente para consulta.
- O workflow `publish-dashboard.yml` gera um pacote público sem textos integrais recuperados, valida o pacote e publica somente `dashboard/dist`. Dados de acesso ao WhatsApp e arquivos de sessão não fazem parte do pacote.
- Pushes humanos ao `main` acionam publicação. Coletas do radar, recuperação de textos e resumo semanal chamam o mesmo workflow após persistirem dados, porque pushes feitos por `GITHUB_TOKEN` não acionam novos workflows de `push`. Uma aba aberta verifica `version.json` a cada cinco minutos e atualiza os dados quando há nova versão.
- O primeiro deploy foi confirmado na [execução de publicação #1](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38005488798). A [recuperação manual #7](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38005601774) persistiu novos textos sem enviar mensagens e executou os jobs reutilizáveis de build e deploy com sucesso; o site passou a mostrar geração às 20h41. A hora da última coleta permaneceu 20h16, corretamente, pois recuperar textos antigos não é nova coleta. URL pública: https://driano1221.github.io/radar-consorcios-whatsapp/ .

## Fluxograma da página “Como funciona” — 09/10/2026

- O usuário pediu um fluxograma real, detalhado e legível, em lugar dos cartões sequenciais. `scripts/build-flow-diagram.mjs` gera SVGs próprios para desktop e celular no build do painel; a página oferece abertura em tamanho real e transcrição textual.
- O desenho acompanha a separação do código: uma publicação passa por coleta, leitura e regras; depois a decisão histórica para a base e o portão de alerta são independentes. **Estar no acervo ou na base não causa envio automático.** O envio considera data original, novidade, fila, cota e revisão opcional pelo DeepSeek. Dúvida impede a liberação automática; IA não confirma sozinha um fato histórico.
- O fluxograma apresenta PDF e OCR como recuperação seletiva, não como leitura automática garantida de toda coleta. As três saídas da base são fato comprovado, descarte motivado e exceção temporária para conferência; esta última segue como dívida de qualidade, não como destino ideal permanente.

## Estado operacional conferido — 09/10/2026, 22h16 (Brasília)

- **Coleta e WhatsApp:** a última execução agendada conferida foi a [#38003502268](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38003502268), iniciada às 20h15. Terminou com sucesso; o estado versionado registra 150 resultados coletados, nenhuma fonte marcada como erro ou degradação nessa rodada, fila vazia ao final e um envio registrado às 20h16 (Umuarama/Conclima). É confirmação do funcionamento nessa execução, não garantia de entrega ou de que execuções futuras nunca falharão.
- **Painel online:** o [site público](https://driano1221.github.io/radar-consorcios-whatsapp/) mostrava a coleta das 20h16 e versão gerada às 20h56. O deploy do fluxograma [#38006821339](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38006821339) terminou com sucesso, e os SVGs desktop/celular foram abertos visualmente. O pacote público é reconstruído do estado versionado, não consulta as fontes em tempo real.
- **Atualização contínua:** `publish-dashboard.yml` publica após push humano em `main`. Coletas, recuperação de textos e resumo semanal o chamam como workflow reutilizável quando persistem mudanças; isso é necessário porque o push do bot com `GITHUB_TOKEN` não dispara outro workflow de `push`. A aba aberta verifica `version.json` a cada cinco minutos; pode ser necessário aguardar esse intervalo ou atualizar a aba manualmente. Se não houve dado novo, não há republicação necessária. A agenda do GitHub Actions é de melhor esforço e pode atrasar ou omitir uma execução; “sempre” depende de a coleta, a persistência e o deploy terminarem com sucesso.
- **Limite da validação nesta data:** o vínculo automático *coleta persistida → deploy* foi adicionado depois da última coleta agendada das 20h15, portanto ainda precisa ser observado na próxima coleta com mudança de estado. O mesmo workflow de publicação já foi validado por push de código e por recuperação de textos; não se fez um disparo extra ao WhatsApp apenas para testar o painel.

## Atos distintos numa mesma edição — 13/10/2026

- Problema: o arquivo histórico usa uma linha por URL. Um diário oficial longo pode conter atos sem relação entre si; a revisão antiga de uma URL inteira atribuía ao PDF um único evento e podia mostrar como prova um trecho de outra página. O caso conferido foi o Diário de Joinville de 09/10/2026: autorização municipal de fornecimento na página 95, com pregão do CISNORDESTE, e apostilamento do Contrato de Rateio 01/2026 entre Joinville e CINCATARINA nas páginas 159–160.
- Solução aplicada: `data/catalogo/atos-identificados.ndjson` guarda chave estável, documento pai, páginas e trecho de cada ato; `src/lib/document-acts.mjs` cria IDs determinísticos a partir de pai + chave. `atos.csv` mostra inclusive os descartes. O documento pai continua uma única linha em `arquivo-coletas.ndjson`, mas deixa de produzir evento ou alerta por si. Revisões por ato são lacradas ao hash do próprio trecho, e a proteção editorial impede que a URL inteira volte ao WhatsApp como rateio.
- Resultado: a compra municipal foi descartada; o apostilamento de rateio ficou confirmado como ato histórico, sem novo envio. O painel mostra pai, filhos, página, decisões e links para a página relevante. A contagem de publicações não foi inflada pelos atos: 1.684 publicações, 2 atos individualizados, 84 fatos confirmados na fotografia publicada. A edição pai ficou `desdobrado` na base e `historico` para alerta.
- Verificação: `npm run catalog:update`, `npm run check`, `npm test` (257/257), build público e validação do pacote passaram. A publicação no GitHub Pages foi conferida na [execução 38428900074](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38428900074) e por leitura dos dados vivos. Não houve teste por envio de WhatsApp.
- Limite explícito: cadastrar os dois atos de Joinville **não** significa que o robô já separa automaticamente todos os atos de PDFs novos. O passo seguinte é detectar fronteiras de atos, atribuir trecho e página corretos e comparar com revisão humana em uma amostra antes de expandir.

## Apresentação do repositório — 13/10/2026

- O README antigo misturava decisões de agosto e setembro com o estado atual, inclusive agendas e privacidade já superadas. Foi refeito como porta de entrada: propósito, ressalva de pesquisa, painel vivo, exemplo verificável, fluxo da evidência, camadas de dados, operação resumida e dívida técnica. Os passos de execução e segurança foram preservados em `docs/OPERACAO.md`.
- Direção visual: banner SVG próprio em `docs/assets/`, dois indicadores reais dos workflows e fluxograma Mermaid nativo do GitHub. Não há imagem de terceiros, dependência de serviço de design nem números estáticos no cabeçalho. A referência foi a documentação do GitHub para README, links relativos, Mermaid e alertas, além de exemplos curados de READMEs; a identidade é editorial e não copia a marca do Ipea.
- Ao manter o README, atualizar primeiro os workflows, `config/default.json` e as contagens do painel; o diagrama deve continuar distinguindo arquivo, decisão da base e portão de alerta. A memória é cronológica; seu bloco inicial de agosto não deve ser interpretado como configuração vigente.
- Referências consultadas: [README e links relativos no GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [Mermaid nativo](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) e a curadoria [awesome-readme](https://github.com/matiassingers/awesome-readme). Serviram para a estrutura e a navegação, não como conteúdo copiado.
