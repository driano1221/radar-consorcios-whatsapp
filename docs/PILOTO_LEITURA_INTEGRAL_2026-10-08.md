# Piloto de leitura integral — 8/10/2026

Escopo: comparar o extrator atual, Mozilla Readability e Trafilatura em quatro casos revisados com o usuário e cinco notícias de outros domínios. **Este piloto local não está publicado no GitHub Actions nem altera envios do WhatsApp.**

## Reproduzir

Executar `npm ci`, criar um ambiente Python em `.local/trafilatura-venv` e instalar `pip install -r requirements-extraction.txt`. Então executar `node scripts/benchmark-extractors.mjs`. O script baixa novamente as páginas públicas, portanto resultados podem variar quando a fonte muda. Os workflows do piloto também instalam essas dependências antes de coletar.

## Resultado nos quatro casos

| Caso | Corte antigo de 4.000 caracteres | Texto integral e leitores novos | Risco restante |
| --- | --- | --- | --- |
| Umuarama/Conclima | Extrator antigo inclui menu de notícias; a categoria não diferencia aprovação de ingresso efetivo. | Os dois leitores começam no corpo; a nova etapa retorna `ADESÃO AUTORIZADA`, com trecho literal. | Ainda é preciso comprovar separadamente o ingresso posterior. |
| Marcelândia/CIDESPA | O ato tem mais de 11 mil caracteres; o anexo fica além do corte. | Os dois leitores preservam o anexo; a nova etapa retorna `GOVERNANÇA` e registra a menção de Marcelândia entre os consorciados. | A lei não revela o ano do ingresso original. |
| Alto Paraguai/CISCN | Encontra valor e Fila Zero, mas perde a data final da vigência. | Os dois leitores encontram valor, objeto e vigência; `RATEIO` permanece com prova da cláusula. | Rateio não comprova adesão nova. |
| Patos de Minas/CISALP | A hipótese de criação era classificada incorretamente como `CRIAÇÃO`. | Os dois leitores, seguidos pela regra de modalidade, retornam `GERAL` e apontam o trecho da hipótese. | Novas formulações de hipótese ainda podem escapar à regra. |

Nas cinco páginas adicionais, Readability e Trafilatura geralmente começaram no corpo da notícia sem menu ou botões de compartilhamento. Houve divergências de classificação que **não** devem ser interpretadas como melhora automática: `atualmt.com.br` mudou de `CRISE` para `RATEIO`, `ograndeabc.com.br` mudou de `GERAL` para `ATUAÇÃO` no Trafilatura, e `bemparana.com.br` continuou `CRIAÇÃO` nos três. Essas páginas ainda precisam de gabarito humano antes de contar acertos.

## Decisão de rollout

Atualização: Readability e Trafilatura foram conectados ao fluxo de notícias neste ramo de piloto. Quando discordam de categoria, ou quando apenas um deles consegue ler o texto, a publicação fica **somente em prévia**. Para AMM-MT, foi preservado o seletor específico `#publication-text`. Uma camada de interpretação separa autorização de ingresso efetivado, alteração de protocolo de nova adesão e hipótese de criação de ato constitutivo. Nos quatro casos revisados, os dois leitores agora levam à categoria editorial esperada. Ainda não há gabarito completo das cinco páginas adicionais, portanto isto não prova precisão em toda a base nem autoriza ativar disparos novos no repositório principal.

Um resumo parcial curto (menos de 1.600 caracteres) também aciona a busca do corpo original, mesmo quando não é idêntico ao título. Isso fecha o caso em que um RSS entregava algumas frases e impedia a leitura da parte decisiva no fim da reportagem. O limite de 12 artigos por rodada continua controlando o custo de rede e de extração.

A distinção jurídica foi cotejada com a [Lei nº 11.107/2005](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11107.htm), especialmente constituição por contrato após protocolo e regras de alteração, e com o [Decreto nº 6.017/2007](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6017.htm), que diferencia o ingresso de ente não previsto no protocolo. A regra operacional é deliberadamente conservadora: notícia de aprovação legislativa é `ADESÃO AUTORIZADA`; ratificação de alteração sem inclusão expressa é `GOVERNANÇA`; presença em lista de consorciados documenta participação, mas não revela o ano do ingresso original.

## Primeira inspeção separada de PDFs

Atualização do painel: os trechos históricos quase duplicados foram consolidados. A releitura automática do PDF de Dracena sinaliza `GOVERNANÇA` em vez de `ADESÃO`, pois o ato ratifica alteração do protocolo sem comprovar ingresso novo; a correção permanece marcada para conferência humana. O arquivo histórico traz página, mas não coluna; portanto a coluna direita foi comprovada no teste local do novo extrator, ainda não exibida no painel para o registro antigo.

Dois PDFs públicos do acervo foram baixados apenas para análise local e renderizados para conferir a página visualmente. O diário de Dracena ([PDF original](https://data.queridodiario.ok.org.br/3514403/2026-08-19/36067dbe2bc2f223ab2ff9b48bcabae7485c1ca1.pdf)) tem cinco páginas e traz a Lei 5.302/2026 sobre o CISNAP na **página 2, coluna direita**. O outro ([PDF original](https://data.queridodiario.ok.org.br/4101408/2026-08-19/1bace690c30e45de765dcb7139be71c54905ebd5.pdf)) tem quatro páginas e não apresentou menção consorcial na recuperação anterior. Ambos têm camada de texto; portanto nenhum justifica OCR. O script `pdf-page-evidence.py` já localizou a menção na página 2, coluna direita, sem misturar o ato da coluna esquerda. O painel local passou a expor páginas das provas recuperadas. O script pode sinalizar páginas digitalizadas para OCR seletivo, mas a execução de OCR ainda não foi validada: não há amostra escaneada no piloto nem Tesseract/OCRmyPDF instalados neste Windows.

## Sorteio e triagem de oito registros (8/10/2026)

O sorteio foi feito entre 32 candidatos ativos **sem revisão editorial**. Cinco eram fatos/documentos distintos e três eram novas representações de fatos já vistos. Cada decisão foi gravada com ID, URL, prova e hash do trecho na base local `revisoes-eventos.ndjson`; nenhuma foi enviada novamente ao WhatsApp.

| Registro | Decisão | Prova e limite |
| --- | --- | --- |
| TCE-MG/Cisrec (`e6bfcce2`) | Incluir — CONTROLE | Notícia oficial 1111629110: suspensão cautelar do credenciamento, estimado em R$ 510 milhões; não é decisão final nem contratação executada. |
| CIDESAA, IT 010/2026 (`dca8e3a4`) | Incluir — ATUAÇÃO | Instrução de trabalho publicada para prevenção de fraude em produtos sob inspeção. Campos de emissão/aprovação em branco: vigência operacional não comprovada. |
| Ribeirão das Neves/ICISMEP (`66f61094`) | Incluir — ADESÃO AUTORIZADA | Corpo da reportagem relata Lei 4.674/2026 autorizando ingresso e assinatura futura; não comprova entrada efetiva. |
| Simão Dias/CONSCENSUL (`60aa5a68`) | Incluir — GOVERNANÇA | PDF físico pp. 2–3, Lei 1.194/2026 ratifica IV Protocolo; art. 3º documenta participação originária já existente e nega adesão automática a programas novos. Ano de ingresso permanece vazio. |
| Inhapi/CONAGRESTE (`58706a3a`) | Incluir — ADESÃO AUTORIZADA | PDF físico pp. 25–26, Lei 261/2026 autoriza adesão e providências para efetivá-la; não prova ingresso consumado. |
| TCE-MG/Cisrec (`cc3db43c`) | Descartar duplicata de `e6bfcce2` | URL alternativa com o mesmo ID oficial 1111629110 e texto idêntico; título antigo dizia equivocadamente “meio milhão”. |
| Consórcio ABC/Metodista (`b04bf3ec`) | Descartar duplicata de `ca8c07d2` | Matéria republica parceria firmada em setembro, já documentada pela fonte oficial; entrega de novembro ainda era futura. |
| Ribeirão das Neves/ICISMEP (`9c2b9970`) | Descartar duplicata de `66f61094` | Mesmo texto e Lei 4.674/2026 sob outra rota do mesmo site. |

Regras ajustadas: URLs antigas do TCE-MG são redirecionadas ao detalhe canônico e seu corpo é recortado com charset correto; instrução interna de prevenção de fraude não é classificada como investigação contra o consórcio; duplicata tem decisão própria, com referência ao documento principal, sem apagar o bruto; o painel separa **fila sem decisão final** de achados já aceitos. A prova dos PDFs foi conferida visualmente nas páginas indicadas. Depois da rodada, a fila final caiu de **37 para 29** (inclui cinco registros antes apenas com categoria corrigida), aceitos de **15 para 20** e duplicatas identificadas de **0 para 3**. A lista geral de registros relacionados a eventos caiu de 68 para 65; esses números não representam novas coletas.

## Fechamento das cinco correções intermediárias

As cinco revisões `corrigir_categoria` foram encerradas com decisão binária, sem reenvio de notícias. Quatro entraram e uma foi descartada:

| Registro | Decisão final | Prova e limite |
| --- | --- | --- |
| Valinhos/SAMU Regional (`55e702b5`) | Incluir — PROPOSTA DE ADESÃO | Ata do Conselho de Saúde, PDF p. 8, coluna direita: a proposta foi aprovada por unanimidade; ingresso e lei autorizativa não comprovados. |
| Votuporanga/COTIMARG (`794018bc`) | Incluir — RATEIO | Contrato 001/2026, PDF pp. 33–38; R$ 340.609,80 para 2027, assinatura em 5/8/2026. Cláusula-padrão de improbidade não é fiscalização. |
| Marília/CONDESU (`d320cc25`) | Incluir — ADESÃO AUTORIZADA | Lei 9.498/2026, PDF p. 2; autoriza atos de ingresso, sem comprová-lo efetivado. |
| CI-DTSA/Serra Azul (`153e40c3`) | Incluir — CRIAÇÃO EM TRAMITAÇÃO | Reportagem de 20/8/2026 relata aval à etapa final pelos prefeitos; não comprova constituição formal nova nem investimentos executados. |
| Campo Mourão/CISNOP (`81946dff`) | Descartar — compra por ata | PDF p. 13 documenta adesão à ata de preços para comprar refrigerador, não ingresso no consórcio nem atuação institucional relevante. |

As regras automáticas passaram a diferenciar proposta de ingresso aprovada pelo Conselho de Saúde, etapa de criação aprovada e cláusula genérica de improbidade em contrato de rateio. Três testes de regressão foram adicionados. O painel teve um erro de precedência corrigido: uma confirmação editorial agora prevalece sobre o descarte automático antigo. Após reconstruir as tabelas derivadas, há **24 confirmados, 24 descartados, 3 duplicatas e 24 ainda sem decisão final**; 16 registros legados sem texto permanecem separados.

Uma simulação **sem alterar o acervo** reclassificou os trechos disponíveis dos 26 candidatos não revisados: 12 apresentaram categoria diferente. São alertas, não 12 correções aprovadas: vários registros só possuem excerto parcial, de modo que a decisão depende de leitura da fonte completa. As decisões editoriais anteriores foram preservadas; nenhuma execução foi publicada ou enviada ao WhatsApp.

## Lote seguinte: oito pendências recentes

Foram escolhidos os oito itens mais recentes da fila, sem sorteio, para testar casos novos de ato oficial, notícia, PDF e repetição. Cada decisão foi associada ao trecho original já arquivado; o PDF de Dois Irmãos foi conferido visualmente na página 15.

| Registro | Decisão | Prova e limite |
| --- | --- | --- |
| CONIAPE/nova sede (`2c093a1e`) | Incluir — ATUAÇÃO | Página oficial de 8/10 afirma que a sede está em construção. Assembleia e visita de 14/10 ainda não tinham acontecido. |
| CIDESAA/Resolução 004 (`30498fed`) | Incluir — ATUAÇÃO | Resolução estabelece procedimentos do Serviço de Inspeção Municipal; citação ao protocolo é fundamento, não alteração constitutiva. |
| Rosário Oeste/Lei 1.887 (`3c0f4467`) | Descartar | Lei abre crédito; R$ 200 mil na rubrica consorcial não prova contrato de rateio novo nem pagamento. |
| Dois Irmãos/CPSINOS (`b745fd88`) | Descartar | PDF p. 15: adesão ao Credenciamento 03.2026/01 para contratar serviço de resíduos, não adesão ao consórcio. |
| General Carneiro/CISGA (`fa9be6fe`) | Incluir — RATEIO | Edital 160/2026 publica aditivo ao contrato 006/2026, aporte extra de R$ 10 mil e vigência até 31/12/2026; repasse efetivo não comprovado. |
| ABC Repórter/Metodista (`934704fa`) | Descartar duplicata de `ca8c07d2` | Republica orientação da fonte oficial sobre parceria firmada em setembro; entrega de documentos de novembro ainda futura. |
| Nova Bandeirantes/CISRAT (`70ccc357`) | Incluir — RATEIO | Segundo aditivo ao contrato 001/2026 assinado em 2/10; R$ 460 mil numéricos, com divergência do valor por extenso em uma cláusula. |
| Torixoréu/CIDESAPA (`7c686c4b`) | Incluir — GOVERNANÇA | Art. 1º da Lei 1.376 ratifica estatuto consolidado; ementa fala de créditos tributários, mas não descreve o corpo real da lei. Não é criação nova. |

Regras acrescentadas: adesão a credenciamento não vira adesão institucional; uma visita/assembleia anunciada para o futuro não é tratada como realizada, mas a construção presente da sede pode ser incluída; resolução operacional do SIM não é confundida com o protocolo citado no preâmbulo. O texto integral real de CIDESAA e CONIAPE foi testado contra as regras novas. Após aplicar somente as oito decisões verificadas: **29 confirmados, 26 descartados, 4 duplicatas e 16 ainda na fila**. Dos candidatos não revisados com algum trecho, oito mudariam de rótulo numa simulação, mas continuam sem alteração automática por dependerem de leitura integral. 171 testes passaram. Sem envio ao WhatsApp e sem publicação do painel.

## Revisão colaborativa de dez casos sorteados

O usuário leu os dez casos e respondeu perguntas sobre ato consumado, mera autorização e duplicidade. Reabri as fontes e conferi visualmente três provas em PDF: Lei 3309/2026 digitalizada de Centenário do Sul, p. 1; Lei 3322/2026 de Pinhais, p. 23; autorização de Primeiro de Maio, p. 2. A página da lei de Centenário tem imagem, sem camada de texto útil, e requer OCR seletivo para uma coleta automática confiável; a leitura manual desta rodada **não** significa que o OCR já esteja implantado.

| ID | Decisão editorial | Distinção comprovada |
| --- | --- | --- |
| `e5771a63` | Incluir — ATUAÇÃO | COIS anunciou contrato assinado para consultas e exames, cerca de R$ 5 milhões; não há prova de pagamento nem de contrato de rateio. |
| `49267d3d` | Incluir — GOVERNANÇA | CODEMA retificou calendário: eleição remarcada para 21/10 e inscrições até 14/10; eleição não ocorrida no ato. |
| `631c477e` | Incluir — CONTROLE | TCE-SP determinou suspensão cautelar da Concorrência 002/2026 do Consórcio Grande ABC; não é decisão final sobre irregularidades. |
| `181fe65e` | Incluir — ADESÃO AUTORIZADA | Lei 4.178/2026 autoriza Caratinga a ingressar no CIMINAS; termo posterior não foi demonstrado. |
| `a01a83c0` | Incluir — ATUAÇÃO | Site do CONIAPE afirma parceria firmada com MAPA para avançar no SISBI; instrumento, verba e implementação não publicados. |
| `94f6bd41` | Incluir — ADESÃO AUTORIZADA | Lei 3309/2026, imagem p. 1, autoriza Centenário do Sul/CISPAR e ratifica contrato/estatuto; não comprova ingresso consumado. |
| `ce0a9f48` | Incluir — ATUAÇÃO | Resolução 003/2026 cria procedimentos operacionais do SIM do consórcio Alto do Rio Paraguai; a Resolução 004 é de outro consórcio, CIDESAA, portanto não é duplicata. |
| `1662dd45` | Descartar duplicata de `58706a3a` | Notícia de Inhapi reconta a Lei 261/2026 já conferida no diário oficial; não há evento novo. |
| `bfeb5bd3` | Incluir — ADESÃO AUTORIZADA | Lei 3322/2026 de Pinhais, PDF p. 23, autoriza ingresso no CISPAR e ratifica contrato/estatuto, sem comprovar entrada consumada. |
| `07e2205b` | Incluir — RATEIO EM TRAMITAÇÃO | PDF de Primeiro de Maio, p. 2: dispensa autorizada para formalizar rateio de 2027 com CISMEPAR, R$ 207.973,68; documentos ainda voltariam ao gabinete para assinatura. |

O classificador agora reconhece no trecho curto a autorização de ingresso de Caratinga, a retificação do calendário eleitoral do CODEMA, a Resolução 003 como norma operacional e a dispensa preparatória de Primeiro de Maio como `RATEIO EM TRAMITAÇÃO`. O rótulo de rateio foi adicionado aos formatos de mensagem sem chamá-lo de contrato assinado. Os outros casos seguem amparados por revisão editorial mesmo quando o trecho arquivado é insuficiente; por exemplo, a publicação do CONIAPE usa a sigla e precisa de identidade de fonte para classificação automática sem inferência arriscada. A revisão posterior de Inhapi só entrou como duplicata após comparação com o PDF primário.

Após reconstruir a base e o painel **locais**: 1.500 documentos brutos, 38 eventos confirmados, 26 descartes editoriais, 5 duplicatas, 6 candidatos na fila e 16 legados sem texto. Os números de confirmados representam decisões sobre documentos, não necessariamente 38 consórcios distintos ou 38 adesões efetivadas. 175 testes passaram. Não houve publicação do painel nem disparo de WhatsApp.

## Fechamento dos seis casos restantes na fila

Revisão individual das fontes, com inspeção visual da Lei 886/2026 de Junqueiro (PDF p. 17) e do Contrato 230/2026 de Campo Mourão (PDF p. 12). As notícias de MT foram comparadas com a publicação original do Estadão MT; o ato estadual citado pelos jornais não foi localizado nesta rodada, limite registrado na revisão. A plenária do Grande ABC ocorreu, mas a agenda em Brasília e os investimentos continuam futuros.

| ID | Decisão | Prova e limite |
| --- | --- | --- |
| `6ce62f55` | Incluir — COOPERAÇÃO AUTORIZADA | Lei 886/2026 autoriza Junqueiro a firmar convênio de compras e serviços com CONAGRESTE; não autoriza ingresso nem prova assinatura do convênio. O trecho arquivado começa no meio do ato: só a leitura da página completa revelou o objeto correto. |
| `ec8a2c34` | Incluir — GOVERNANÇA | Lei 1193/2026 de Araguainha ratifica estatuto consolidado e alteração contratual do CIDESAPA. É ato municipal próprio, não duplicata da lei de Torixoréu, e não cria consórcio novo. |
| `229de91a` | Incluir — ATUAÇÃO | Plenária de prefeitos de 22/9 com ministro definiu encaminhamento de agenda setorial; reuniões futuras em Brasília e investimentos não foram computados como realizados. |
| `6b8457b9` | Incluir — ATUAÇÃO | Extrato do Contrato de Prestação de Serviços 230/2026, Campo Mourão/CONDESCOM, p. 12, R$ 40 mil, assinatura em 21/9; menção ao protocolo é fundamento, não alteração. |
| `b4e307c8` | Incluir — FINANÇAS | Estadão MT informa incentivo PAICI de agosto zerado para oito municípios por inadimplência das cotas; não significa insolvência dos consórcios. Registro republicado por Isso É Notícia foi preservado como representante do fato no acervo. |
| `3b3368b3` | Descartar duplicata de `b4e307c8` | AtualMT reproduz o mesmo título, oito municípios e fato do PAICI. A reportagem original do Estadão MT foi publicada em 15/9; AtualMT em 16/9. |

Novas regras de regressão distinguem autorização de convênio de adesão, ratificação de estatuto de protocolo novo, extrato de contrato de serviços de protocolo citado no objeto e retenção de incentivo por inadimplência municipal de crise do consórcio. O excerto histórico de Junqueiro ainda é insuficiente para reclassificação automática: a **decisão editorial está comprovada pela página completa** e o leitor de PDFs deve preservar esse contexto nas próximas coletas. As seis revisões foram aplicadas somente ao acervo e ao painel locais. Resultado: **43 confirmados, 26 descartes editoriais, 6 duplicatas, 0 na fila e 16 legados sem texto**; 179 testes passaram. Nenhum envio ao WhatsApp ou publicação no GitHub Pages.

## Recuperação dos 16 legados, portaria PAICI e revisão local do painel

Foram baixados e lidos os 16 PDFs antigos sem trecho arquivado. O diário de Maracaju tem 474 páginas e 34,6 MiB; sua recuperação estava em arquivo separado que o painel não lia. A busca antiga interrompia o PDF após 25 ocorrências, mesmo quando o ato pertinente vinha em página posterior. O limite passou a ser **por página**, e o painel agora combina recuperação normal, PDFs grandes e prova curada. Cada decisão foi lacrada ao registro arquivado, com página e fonte no livro de revisões. O excerto original do arquivo bruto continua vazio nesses 16; a prova recuperada e a decisão editorial ficam em camadas separadas, para não fingir que o robô coletou o texto na época.

| Município/documento | Decisão fundamentada |
| --- | --- |
| Mata Grande/AL, p. 34 | Lei 282/2026 **autoriza** adesão ao CONAGRESTE; entrada efetiva pendente. |
| Valinhos/SP, pp. 17–18 | PL 200/2026 sobre prorrogação no CISMETRO aprovado só em primeira discussão. |
| Novo Lino/AL, p. 51 | Lei 396/2026 autoriza adesão ao CONAGRESTE; efetivação futura. |
| Maracaju/MS, p. 174 | **Descartado**: CNAE comercial de consórcios de bens e direitos, não consórcio público. |
| Recife/PE, pp. 45–46 | PL 10/2026 para ratificar protocolo do CONIAPE aprovado em segunda discussão por 25 votos; sanção não localizada no PDF. Menções empresariais nas páginas 38–44 não anulam esse achado. |
| Macaé/RJ, p. 6 | Delegação administrativa ligada a rateio já celebrado com CIDENF; contrato novo e pagamento não demonstrados. |
| Dracena/SP, p. 2 | Lei 5302/2026 altera protocolo do CISNAP, participação preexistente desde 2017. |
| Maravilha/AL, p. 44 | Lei 548/2026 autoriza adesão ao CONAGRESTE, sem prova de entrada concluída. |
| Salinas/MG, p. 100 | Contrato de rateio com CISRUN assinado em 28/4/2026; na mesma página há contrato de serviços separado com CIMES. O catálogo ainda representa os dois atos em um único documento. |
| Piranhas/AL, pp. 50–51 | Publicada como Lei 475/2026, autoriza adesão ao CONAGRESTE; preâmbulo conserva texto de Projeto de Lei. Ressalva documental explícita, sem inferir ingresso. |
| São Mateus do Sul/PR, p. 11 | Subscrição do protocolo do CONCLIMA; ratificação e adesão efetiva não comprovadas. |
| Jundiaí/SP, pp. 13, 33 | Crédito de R$ 500 mil para rateio variável CISMETRO, sem prova de desembolso; ato de credenciamento CONDESU na p. 33 é distinto. |
| Itápolis/SP, p. 2 | Lei 4415/2026 ratifica protocolo do CONCLIMA; não basta, isoladamente, para marcar ingresso consumado. |
| Contagem/MG, p. 38 | Aditivo de R$ 102.246,32 ao rateio 40/2026 com ICISMEP, sem transferência financeira adicional. |
| Costa Rica/MS, p. 8 | Lei 1910/2026 altera protocolo do COINTA, consórcio de que já consta como participante. |
| Campo Belo/MG, p. 26 | Lei 4497/2026 **autoriza saída** do CISMARG; desligamento formal ainda pendente. |

O teste de regressão detectou o falso descarte inicial de Recife: os excertos do início do diário eram irrelevantes, mas as páginas 45–46 traziam o ato consorcial. Esta é a prova prática de que não se deve encerrar a leitura do documento após um número global de menções.

**PAICI:** a [Portaria 0654/2026/GBSES](https://iomat.mt.gov.br/legislacao/diario_oficial/detalhes/1031058), Diário Oficial de Mato Grosso nº 29316 de 15/9/2026, foi localizada. Ordena R$ 2.479.610,50 para a competência agosto/2026. Seu anexo mostra exatamente Nova Olímpia, São José do Rio Claro, Nova Nazaré, Barra do Bugres, Jaciara, Acorizal, Poconé e Santo Antônio do Leverger com PAICI-mês e PAICI-ano em R$ 0,00, marcados como inadimplentes segundo a Portaria 210/2023. Isso confirma a notícia, mas **ordem de repasse não é comprovante bancário**, e inadimplência municipal não implica falência do consórcio.

O catálogo e o painel locais foram reconstruídos e testados no navegador: a lista abre nos achados conferidos quando a fila está vazia, mostra títulos concretos para diários genéricos, página do PDF, data da edição inferida do URL quando a data antiga não foi arquivada, e link da prova editorial (incluindo a portaria oficial PAICI). Estado local: **1.500 documentos, 58 confirmados, 27 descartes editoriais, 6 duplicatas, 0 em triagem, 0 legados por verificar**. Ainda há **2 identidades de consórcio não resolvidas** e **123 documentos brutos sem texto nem revisão**; isso não equivale a 100% de cobertura do acervo. **181 testes passaram.** Sem publicação externa nem envio de WhatsApp nesta rodada.
