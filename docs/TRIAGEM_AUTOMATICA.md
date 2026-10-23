# Triagem automática — estado em 23/10/2026

## Correção de rubricas e fila — 23/10

A [Lei 3.431/2026 de Juara](https://amm.diariomunicipal.org/publicacao/1929786/) abre crédito especial de R$ 80 mil. “Transferências a Consórcios Públicos mediante contrato de rateio” é uma rubrica da dotação. O texto integral preservado confirma abertura de crédito, sem celebração ou pagamento de rateio. A regra agora rejeita esse padrão documental, independentemente do nome/URL, e não alcança extratos de contratos efetivamente firmados ou atos orçamentários do próprio consórcio.

Uma categoria encontrada por palavras-chave não é prova de conflito documental. Sem prova positiva específica, discordância de classificação permanece com o bot para delimitar o ato; uma rejeição da segunda leitura com citação válida pode concluir o descarte. Conflitos documentais explícitos, como nomes divergentes na ementa e no artigo operativo, mantêm seu tratamento específico. Decisões humanas continuam tendo precedência.

A versão 3 migra apenas decisões automáticas ainda em revisão/processamento. Não reabre confirmações, rejeições, lotes retroativos ou revisões humanas; decisões seladas das versões 1 e 2 continuam válidas. A classificação recalculada do original também substitui a cópia antiga da regra antes de reaplicar a segunda leitura no catálogo.

**Fila de envio é um eixo de entrega, separado da decisão.** O painel e o CSV indicam “Na fila de envio” somente quando a notícia está confirmada, consta na fila operacional, não tem entrega e não está bloqueada como histórica ou Controle/Fiscalização. Itens guardados operacionalmente antes de concluir a leitura continuam em processamento/revisão, com o motivo documental, e não contam como confirmados prontos para envio. O novo filtro e contador mostram apenas confirmadas aguardando publicação. O painel usa a triagem persistida como alternativa quando a ficha do catálogo ainda não a contém; o motivo “na fila” não substitui a dúvida de leitura.

A manutenção reavaliou 27 pendências automáticas: dois descartes e 25 processamentos, sem confirmações presumidas para esvaziar indicadores. As 484 revisões humanas, os lotes selados, os textos integrais e todos os arquivos de estado/sessão/fila/recibos foram preservados por comparação de hashes. Nenhuma coleta, chamada de IA, conexão WhatsApp ou envio foi disparado pela manutenção. Novas coletas legítimas podem mudar os números; a publicação é conferida separadamente.

Validação: 560 testes aprovados em ambiente isolado, com mensagens, IA e persistência operacional desligadas. Painel público e CSV conferidos para 3.716 registros: 227 confirmados, 3.463 rejeitados, zero revisões humanas e 26 processamentos; três confirmados aparecem separadamente na fila de envio. A interface foi aberta em prévia local: o filtro da fila apresentou exatamente as três confirmadas, com a coluna WhatsApp coerente. Dez itens do armazenamento operacional ainda aguardam triagem e não foram declarados prontos para envio. O pacote foi validado por hashes e contagem das partes, sem perda de linhas no CSV.

Na seleção operacional, aprovação da IA só ocupa uma vaga da rodada depois de concluir a triagem canônica e passar pela preferência de canal. Um item aprovado pela IA, mas ainda em processamento, não bloqueia uma notícia já pronta atrás dele na fila. Permanecem os mesmos tetos de mensagens e chamadas; o teste reproduz esse caso apenas com cache simulado, sem chamada externa ou envio.

## Fluxo em produção

**Coletar → ler o original → decidir com prova → confirmar ou rejeitar → considerar o WhatsApp.** Falta de texto, citação inválida ou segunda leitura pendente ficam em **Em processamento automático**. Revisar comigo exige conflito específico não resolvido; releitura fraca não reabre decisões concluídas. Inferências editoriais expressamente autorizadas podem concluir a classificação de um ato publicado com ressalvas visíveis, sem comprovar atributos ainda incertos. Confirmar o conteúdo não remove os controles de data, novidade, cota ou preferência de canal.

O painel usa sete famílias: **Criação, Adesão, Saída, Rateio, Protocolo, Crise e Atuação**. Governança, Finanças e Controle/Fiscalização aparecem como subtipos de Atuação. As etapas jurídicas continuam explícitas: autorização não equivale a ingresso, assinatura não equivale a pagamento. Controle/Fiscalização continua somente no painel, inclusive fora do boletim do WhatsApp.

`simple-triage.mjs` aplica uma decisão canônica aos originais e ao envio diário. Confirma por regra documental específica ou concordância da regra com uma segunda leitura válida e evidência literal no corpo. A regra independente é preservada antes de aplicar a opinião da IA. Rejeição exige prova de exclusão; falha de acesso nunca é irrelevância. O resumo semanal preserva a decisão canônica guardada, exige confirmação e continua excluindo as revisões históricas deste lote.

## Lote inicial: as 69 pendências

**Atualização após a revisão conjunta dos 39 casos:** 22 confirmações, 12 rejeições, quatro documentos complementares/duplicados e uma pendência (caso 31, aditivo com valores, ano e assinatura divergentes). O [resultado preserva os números originais](REVISAO-CONJUNTA-39-2026-10-21.md). As 416 revisões anteriores e o arquivo bruto foram mantidos; foram acrescentadas 38 decisões, todas com `publicar=false` e `incluir_resumo=false`.

Conferência reproduzível: `node scripts/apply-joint-review-39.mjs` simula; `--apply` aplica somente se ainda faltar o lote completo. A aplicação é idempotente, valida provas e hashes e não importa clientes de rede/WhatsApp. O script inicial abaixo passa a preservar o relatório congelado quando encontra revisão humana posterior.

As regras aprendidas distinguem LDO e cronograma de um rateio assinado, conselho consultivo de protocolo, ratificação legal de ingresso e cooperação autorizada de criação. Normas operacionais publicadas com prova literal não exigem revisão só por serem longas ou por uma interpretação antiga da IA. O aceite do credenciamento do caso 38 é uma inclusão expressa desse caso pelo usuário; não amplia automaticamente o escopo para todos os contratos de fornecedores. Valores dessa notícia secundária continuam sem conferência independente no diário.

A leitura manual dos casos 3–13 acrescentou dois critérios gerais: lançamento de cadastro com convite aberto confirma Atuação em andamento, sem levantamento concluído; ratificação legal de alteração do contrato confirma Atuação/Governança publicada, sem inferir conteúdo do anexo ou novo ingresso. Edital, homologação parcial e contrato rotineiro com fornecedor continuam distintos desses fatos. Atos adjacentes na mesma página não têm objeto/vínculo presumido. [Decisões, limites e casos restantes](REPROCESSAMENTO-310-2026-10-22.md#leitura-manual-dos-casos-313).

A leitura dos casos 14–27 encerrou a lista manual, com duas confirmações e 12 rejeições. Lei sancionada com “Art. 1º Ratifica o protocolo” recebe o mesmo tratamento documental de “Fica ratificado”: confirma somente a ratificação legal, com a data histórica do ato. Dispensa municipal publicada pelo art. 75, XI, que identifica a contratação de serviço de consórcio confirma **Atuação · Cooperação autorizada**; não comprova contrato firmado, prestação, pagamento ou novo ingresso. A regra exige o aviso operativo no corpo, não notícia de intenção, fornecedor privado ou resumo. A convocação futura de assembleia continua rejeitada como constituição não comprovada. [Decisões, conferências de OCR e limites](REPROCESSAMENTO-310-2026-10-22.md#leitura-manual-dos-casos-1427).

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
