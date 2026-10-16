# Simulação de confirmação automática de originais — 16/10/2026

**Conclusão: não ativar ainda.** Na amostra de 40 textos, a proposta resolveu 21 (52,5%) e reteve 19. Nenhuma das decisões efetivamente propostas divergiu do aceite/descarte ou categoria editorial, nesta amostra. Isso não é 100% de acerto no acervo nem garantia sobre notícias futuras.

## Segurança e reprodução

- Execução [38957521537](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38957521537), commit d8ffbb736b0b2e246acf7e22afd0ba20430d1272, concluída com sucesso. Experimento apenas na branch **test/original-triage-simulation**; main, painel e fluxo de produção não foram modificados.
- **Zero chamadas de WhatsApp; zero alterações em data/, state/, config/ ou src/.** O executor compara hashes antes/depois; não há modo de aplicação, importação de emissor nem credenciais de WhatsApp.
- 40 chamadas DeepSeek, sem erro de API, corpo completo e sem truncamento; 98.225 tokens de entrada e 8.796 de saída. Respostas não alimentaram o cache de IA da produção.
- 423 testes locais passaram, incluindo sete novos de isolamento, integridade, evidência literal, etapa, identidade e ausência de alteração da produção. Os sete testes novos também passaram no Actions.
- Corpus congelado: d29c1649b91daf06321b0042faa6534a25aa0c757d20e3cf917f20e9c74ecf4d. Dados de 2026-10-16T19:48:29.346Z. Novas coletas posteriores não estão incluídas.

## Antes e depois — os mesmos 40 casos

“Antes” abaixo é a hipótese de **promover diretamente o resultado das regras**, não o estado da base publicada. “Depois” é a política experimental: regra + IA, trecho literal, etapa definida e identidade comprovada (ou orientação geral explícita).

| Resultado | Só regras, sem as novas travas | Proposta com travas + IA |
| --- | ---: | ---: |
| Aceitar conteúdo | 24 | 8 |
| Descartar conteúdo | 16 | 13 |
| Reter para resolver | 0 | 19 |
| Divergências de aceite/descarte frente à referência | 1 | 0, entre 21 decididos |
| Categoria divergente nos aceites | 1 | 0 |

Os oito aceites não são oito novos fatos: são decisões simuladas de registros que já revisamos. Nenhum foi aplicado nem reenviado. A camada de deduplicação ainda precisa ser validada antes de promover qualquer registro novo.

## O que foi comparado no acervo

| Universo | Quantidade |
| --- | ---: |
| Publicações arquivadas | 1982 |
| Textos integrais armazenados | 263 |
| Leituras elegíveis para este piloto de originais | 244 |
| Elegíveis com alguma revisão editorial | 89 |
| Comparação principal: aceite/descarte com a mesma fonte | 58 |
| Concordância das regras nessa comparação principal | 55/58 |
| Falsos aceites pelas regras | 3 |
| Falsos descartes pelas regras | 0 |
| Categorias divergentes entre conteúdos aceitos | 2 |
| Segunda leitura de IA, amostra estratificada fixa | 40 |

Os 21 registros marcados como duplicata são analisados à parte, pois duplicata não é sinônimo de conteúdo irrelevante. Há 14 elegíveis cuja revisão usa outra URL como evidência; alguns também são duplicatas, portanto esses números não devem ser somados. Sete atos separados manualmente não foram usados como se fossem originais extraídos automaticamente.

As 1719 publicações sem íntegra armazenada **não representam 1719 falhas novas**: muitas são notícias fora do tema que não precisaram de leitura completa no fluxo vigente. Este piloto exige íntegra e não reclassifica esses registros por ausência de texto. Também ficaram fora 13 PDFs, cinco textos acima de 24 mil caracteres e uma reprodução identificada. Não foi usado truncamento para fazê-los caber.

## Por que 19 ainda não receberam decisão

| Motivo | Casos | Próxima correção |
| --- | ---: | --- |
| Regra e IA discordaram | 5 | Exigir prova municipal de composição; requerimento aprovado não equivale a autorização legal; separar categoria de etapa. |
| Etapa ou prova da regra insuficiente | 5 | Definir a etapa do fato e selecionar o trecho principal; não aproveitar boilerplate de assembleia. |
| IA apontou vários atos | 5 | Distinguir vários efeitos de uma mesma norma de atos realmente independentes. |
| Validação literal do nome falhou | 4 | Comparar caixa/acentos e separar nome da sigla, mantendo prova no corpo; não inferir CNPJ. |

### Exemplos reais

- **Reunião ABC–Braskem:** aceito como atuação realizada; não afirma acordo ou entrega.
- **Composição do consórcio de acolhimento/Amurc:** aceito como governança; não cria ano de ingresso.
- **CNM / orientação tributária:** aceito como FINANÇAS de abrangência geral, sem entidade fictícia.
- **Convocação da 121ª assembleia CIMCERO:** descartada, conservando o documento no acervo.
- **Ficha do Acórdão 2330/2025, TCE-PR:** a regra propôs FINANÇAS; a IA identificou insuficiência do conteúdo. A trava reteve o caso, em vez de aceitar uma ficha como julgamento comprovado.
- **ABC + Seguro:** regra e IA concordaram em GOVERNANÇA, mas nossa referência é ATUAÇÃO. A trava de etapa/prova barrou a promoção. Concordância entre regra e IA, sozinha, não assegura acerto.
- **São Lourenço da Mata:** a IA interpretou aprovação de requerimento como autorização de ingresso; a regra discordou e bloqueou. Mantém-se o critério já decidido pelo usuário.
- **CEMMIL / seleção de pessoal e CISVARC / próteses:** a IA chamou identificação do nome da entidade de “composição”. Não apresentou municípios consorciados como prova. A regra barrou ambos; não há decisão editorial nova a pedir ao usuário.
- **Quatro nomes:** falharam porque a IA acrescentou sigla entre parênteses ao nome, ou mudou caixa/acentos, sem repetir essa forma exata na citação. São limitações do validador deste protótipo, não quatro entidades comprovadamente desconhecidas.

## Divergências das regras no conjunto principal de 58

| Publicação | Nossa referência | Regra | Tipo de problema |
| --- | --- | --- | --- |
| [Detalhes do Acórdão - 2330/2025 - Primeira Câmara - viajuris.tce.pr.gov.br](https://viajuris.tce.pr.gov.br/Pesquisa/DetalhesAcordao?idAto=199084) | descartado | FINANÇAS | Aceitaria conteúdo insuficiente/listagem |
| [Consórcio ABC inicia segunda fase do ABC + Seguro com foco em tecnologia e capacitação das GCMs - Consórcio Intermunicipal - Grande ABC](https://www.consorcioabc.sp.gov.br/noticia/print-noticia/6137/consorcio-abc-inicia-segunda-fase-do-abc-seguro-com-foco-em-tecnologia-e-capacitacao-das-gcms/) | ATUAÇÃO | GOVERNANÇA | Categoria do fato |
| [Lista de outras publicações - cpsibiapaba.ce.gov.br](https://cpsibiapaba.ce.gov.br/publicacoes) | descartado | RATEIO | Aceitaria conteúdo insuficiente/listagem |
| [TCE-PB reprova contas de 2023 do Consórcio de Saúde do Vale do Piancó e multa gestor em R$ 3 mil - poderpb.com.br](https://poderpb.com.br/2026/10/01/tce-pb-reprova-contas-de-2023-do-consorcio-de-saude-do-vale-do-pianco-e-multa-gestor/) | CONTROLE | FINANÇAS | Categoria do fato |
| [Publicações - CÂMARA MUNICIPAL DE CANGUARETAMA](https://canguaretama.rn.leg.br/plugin.php?slug=publicacoes&page=categoria.php&category_slug=leis&p=4) | descartado | ADESÃO AUTORIZADA | Aceitaria conteúdo insuficiente/listagem |

## Amostra completa de 40: decisão anterior e proposta

| Publicação | Referência editorial | Regra | IA | Proposta |
| --- | --- | --- | --- | --- |
| [CIMCERO convoca municípios para participarem da 121ª Assembleia Geral Ordinária - Consórcio CIMCERO](https://consorciopublico.ro.gov.br/noticias/202) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [Correios esperam novo empréstimo até o dia 15; consórcio de bancos conta com três instituições estrangeiras - Portal Barcelos na NET](https://barcelosnanet.com.br/correios-esperam-novo-emprestimo-ate-o-dia-15-consorcio-de-bancos-conta-com-tres-instituicoes-estrangeiras/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [Consórcio ABC e Braskem discutem fortalecimento da indústria e preservação do Polo Petroquímico - abcdjornal.com.br](https://abcdjornal.com.br/maua/noticia/2026/09/10/consorcio-abc-e-braskem-discutem-fortalecimento-da-industria-e-preservacao-do-polo-petroquimico/) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Aceitar |
| [Acompanhamento de Matéria - sapl.patobranco.pr.leg.br](https://sapl.patobranco.pr.leg.br/materia/33573/acompanhar-materia/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [Após suspensão de cirurgias, MP cobra prefeitos por solução em hospital - pontonacurva.com.br](https://www.pontonacurva.com.br/executivo/apos-suspensao-de-cirurgias-mp-cobra-prefeitos-por-solucao-em-hospital/35001) | Aceitar · CONTROLE | CONTROLE | CONTROLE | Aceitar |
| [Detalhes do Acórdão - 2330/2025 - Primeira Câmara - viajuris.tce.pr.gov.br](https://viajuris.tce.pr.gov.br/Pesquisa/DetalhesAcordao?idAto=199084) | Descartar | FINANÇAS | IRRELEVANTE | Pendente · Regra e IA discordaram |
| [Consórcio ABC Recebe Curso Sobre Assistência Técnica Para Habitação De Interesse Social - abcagora.com.br](https://abcagora.com.br/2026/09/18/consorcio-abc-curso-athis-habitacao/) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Pendente · Etapa ou prova da regra insuficiente |
| [Consórcio ABC inicia segunda fase do ABC + Seguro com foco em tecnologia e capacitação das GCMs - Consórcio Intermunicipal - Grande ABC](https://www.consorcioabc.sp.gov.br/noticia/print-noticia/6137/consorcio-abc-inicia-segunda-fase-do-abc-seguro-com-foco-em-tecnologia-e-capacitacao-das-gcms/) | Aceitar · ATUAÇÃO | GOVERNANÇA | GOVERNANÇA | Pendente · Etapa ou prova da regra insuficiente |
| [Amurc abre novo processo seletivo para completar equipe de Consórcio de Acolhimento em Curitibanos - asemanacuritibanos.com.br](https://asemanacuritibanos.com.br/featured/amurc-abre-novo-processo-seletivo-para-completar-equipe-de-consorcio-de-acolhimento-em-curitibanos/) | Aceitar · GOVERNANÇA | GOVERNANÇA | GOVERNANÇA | Aceitar |
| [LEI MUNICIPAL Nº 1193/2026, DE 02 DE OUTUBRO DE 2026](https://amm.diariomunicipal.org/publicacao/1919144/) | Aceitar · GOVERNANÇA | GOVERNANÇA | GOVERNANÇA | Pendente · IA apontou vários atos |
| [CONTRATO DE RATEIO N.º 055/2.026 - CONSÓRCIO INTERMUNICIPAL DE SAUDE](https://amm.diariomunicipal.org/publicacao/1919732/) | Aceitar · RATEIO | RATEIO | RATEIO | Aceitar |
| [RETIFICAÇÃO DO REGULAMENTO ELEITORAL – BIÊNIO 2027/2028 ELEIÇÃO DA DIRETORIA DO CONSÓRCIO INTERMUNICIPAL DE DESENVOLVIMENTO ECONÔMICO, SOCIAL E AMBIENTAL DO MÉDIO ARAGUAIA – CODEMA](https://amm.diariomunicipal.org/publicacao/1919389/) | Aceitar · GOVERNANÇA | GOVERNANÇA | GOVERNANÇA | Aceitar |
| [SEGUNDO TERMO ADITIVO AO CONTRATO DE RATEIO Nº 001/2026](https://amm.diariomunicipal.org/publicacao/1919856/) | Aceitar · RATEIO | RATEIO | RATEIO | Pendente · Validação literal do nome falhou |
| [SAPL - Câmara Municipal de São Lourenço da Mata - PE - sapl.saolourencodamata.pe.leg.br](https://sapl.saolourencodamata.pe.leg.br/sessao/914/votacao-simbolica-transparencia/4911/9957?&materia=ordem) | Descartar | GERAL | ADESÃO AUTORIZADA | Pendente · Regra e IA discordaram |
| [LEI MUNICIPAL Nº 1.261/2026 SÚMULA: “RATIFICA A ALTERAÇÃO DO PROTOCOLO DE INTENÇÕES E DO CONSÓRCIO INTERMUNICIPAL DE DESENVOLVIMENTO SUSTENTÁVEL PORTAL DA AMAZÔNIA - CIDESPA, EM CONFORMIDADE COM A LE](https://amm.diariomunicipal.org/publicacao/1920936/) | Aceitar · GOVERNANÇA | GOVERNANÇA | PROTOCOLO | Pendente · Regra e IA discordaram |
| [Consórcio ABC Lança Ação Para Estruturar Cadeia Do Cambuci - ABC Agora](https://abcagora.com.br/2026/10/07/consorcio-abc-cadeia-do-cambuci/) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Aceitar |
| [Lei 1887 - 2026](https://amm.diariomunicipal.org/publicacao/1922173/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [INSTRUÇÃO NORMATIVA Nº 016 DE 02 DE OUTUBRO DE 2026.](https://amm.diariomunicipal.org/publicacao/1921829/) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Pendente · Validação literal do nome falhou |
| [IT - INSTRUÇÃO DE TRABALHO Nº 010/2026 PROGRAMA DE PREVENÇÃO E COMBATE À FRAUDE.](https://amm.diariomunicipal.org/publicacao/1921820/) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Pendente · Validação literal do nome falhou |
| [EXTRATO DO 2º TERMO ADITIVO AO CONTRATO ADMINISTRATIVO Nº 283/2024 - ADESÃO 08/2024](https://amm.diariomunicipal.org/publicacao/1922706/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [Falhas na concessão de gratificações levam TCE-PB a reprovar contas de consórcio de saúde do Vale do Piancó - Fonte 83](https://fonte83.com.br/politica/prefeituras/falhas-na-concessao-de-gratificacoes-levam-tce-pb-a-reprovar-contas-de-consorcio-de-saude-do-vale-do-pianco/) | Aceitar · CONTROLE | CONTROLE | CONTROLE | Aceitar |
| [MP investiga suspeita de cartel na contratação de médicos em oito cidades do Paraná - Gazeta do Paraná](https://gazetadoparana.com.br/publico/mp-investiga-suspeita-de-cartel-na-contratacao-de-medicos-em-oito-cidades-do-parana) | Aceitar · CONTROLE | CONTROLE | CONTROLE | Pendente · Etapa ou prova da regra insuficiente |
| [PROJETO DE LEI ORDINÁRIA N.º 1129/2026 - corregofundo.mg.leg.br](https://www.corregofundo.mg.leg.br/proposicoes/Projetos-de-Lei-Ordinaria/2026/1/0/469) | Aceitar · GOVERNANÇA | GOVERNANÇA | GOVERNANÇA | Pendente · IA apontou vários atos |
| [Consórcio ABC lança programa ABC + Cultura para fortalecer integração regional e impulsionar a economia criativa - Consórcio Intermunicipal - Grande ABC](https://consorcioabc.sp.gov.br/noticia/6062/consorcio-abc-lanca-programa-abc-cultura-para-fortalecer-integracao-regional-e-impulsionar-a-economia-criativa/) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Pendente · IA apontou vários atos |
| [Ex-presidente de consórcio do Rio Paraná é multado por atraso no envio de dados - TCE-PR](https://www.tce.pr.gov.br/noticias/ex-presidente-de-consorcio-do-rio-parana-e-multado-por-atraso-no-envio-de-dados/4039/N-4936B620A10BFD0701A121F65293424B-00.htm) | Aceitar · CONTROLE | CONTROLE | CONTROLE | Pendente · Etapa ou prova da regra insuficiente |
| [Consórcio de Saúde Garças/Araguaia viabiliza procedimentos oftalmológicos para mais 100 pacientes da região - Araguaia Notícia](https://araguaianoticia.com.br/noticia/79550/consorcio-de-saude-garcasaraguaia-viabiliza-procedimentos-oftalmologicos-para-mais-100-pac) | Aceitar · ATUAÇÃO | ATUAÇÃO | ATUAÇÃO | Pendente · Etapa ou prova da regra insuficiente |
| [Tribunal de Contas mantém bloqueados pagamentos de contrato de energia solar - TCE RN](https://www.tce.rn.gov.br/Noticias/NoticiaDetalhada/8119) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [CNM orienta gestores sobre posição da Receita Federal que trata de consórcios públicos - Confederação Nacional de Municípios (CNM)](https://ama-al.com.br/cnm-orienta-gestores-sobre-posicao-da-receita-federal-que-trata-de-consorcios-publicos/) | Aceitar · FINANÇAS | FINANÇAS | FINANÇAS | Aceitar |
| [1.200 pessoas lotam auditório da Fiep para acompanhar seminário do Progov](https://www.tce.pr.gov.br/noticias/1-200-pessoas-lotam-auditorio-da-fiep-para-acompanhar-seminario-do-progov.htm) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [DÉCIMO PRIMEIRO TERMO ADITIVO AO CONTRATO DE RATEIO Nº 001/2026](https://amm.diariomunicipal.org/publicacao/1924395/) | Aceitar · RATEIO | RATEIO | RATEIO | Pendente · Validação literal do nome falhou |
| [LEI ORDINÁRIA Nº 1.148, DE 08 DE OUTUBRO DE 2026.](https://amm.diariomunicipal.org/publicacao/1924135/) | Aceitar · GOVERNANÇA | GOVERNANÇA | PROTOCOLO | Pendente · IA apontou vários atos |
| [LEI ORDINÁRIA Nº 1.118, DE 25 DE JUNHO DE 2026.](https://amm.diariomunicipal.org/publicacao/1924128/) | Aceitar · ADESÃO AUTORIZADA | ADESÃO AUTORIZADA | ADESÃO AUTORIZADA | Pendente · IA apontou vários atos |
| [Curitiba e Pinhais são primeiros destaques em evento dos 5 anos do Progov na Fiep](https://www.tce.pr.gov.br/noticias/curitiba-e-pinhais-sao-primeiros-destaques-em-evento-dos-5-anos-do-progov-na-fiep.htm) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [Processo seletivo na Grande São Paulo abre inscrições para 28 vagas - JC Concursos](https://jcconcursos.com.br/noticia/concursos/processo-seletivo-na-grande-sao-paulo-abre-inscricoes-para-28-vagas-146014) | Descartar | GERAL | GOVERNANÇA | Pendente · Regra e IA discordaram |
| [TCE-PR celebra 5 anos do Progov reconhecendo boas práticas de 28 municípios - TCE-PR](https://www.tce.pr.gov.br/noticias/tce-pr-celebra-5-anos-do-progov-reconhecendo-boas-praticas-de-28-municipios.htm) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [EXTRATO DE TERMO DE RATIFICAÇÃO](https://amm.diariomunicipal.org/publicacao/1925327/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [125-2026 - Termo de Inex 02.2026 - HOSPITAL SANTA RITA VG](https://amm.diariomunicipal.org/publicacao/1926182/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [126-2026 - Termo de Inex 7.2026 - LABORATORIO DE PRÓTESE DENTÁRIA SOLUÇÃO LTDA.](https://amm.diariomunicipal.org/publicacao/1926180/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [124-2026 - Termo de Inex 01.2026 - HOSPITAL SANTA RITA VG](https://amm.diariomunicipal.org/publicacao/1926220/) | Descartar | GERAL | IRRELEVANTE | Descartar |
| [Consórcio prevê R$ 3,6 milhões para fornecer 6,4 mil próteses dentárias gratuitas em MT - Fatos de Mato Grosso](https://www.fatosdematogrosso.com.br/cidades/consorcio-preve-r-36-milhoes-para-fornecer-64-mil-proteses-dentarias-gratuitas-em-mt/17488) | Descartar | GERAL | GOVERNANÇA | Pendente · Regra e IA discordaram |

## Limites e próxima rodada

- Amostra já usada para desenvolver regras: regressão, não teste independente de generalização.
- Duplicatas são avaliadas à parte; não recebem rótulo presumido de relevância. Equivalência exata proposta não é deduplicação completa.
- Referências apoiadas em outro documento são separadas da métrica principal; a simulação não recebe esse documento por conhecimento da resposta.
- Referências incluem decisões do usuário e revisões do assistente; não equivalem a auditoria humana independente.
- A IA vê a categoria da regra, mas não a decisão editorial. Concordância não é confirmação independente.
- Somente textos originais integrais elegíveis; PDFs e lacunas não são descartes temáticos.
- A amostra foi escolhida com semente fixa e estratificação pela regra, sem passar a resposta editorial ao modelo. Na amostra há 23 aceites e 17 descartes de referência. Não é uma amostra representativa do fluxo diário.
- A seleção de etapa ainda é incompleta, e uma etapa genérica como “celebração a conferir” não deve autorizar promoção. Acrescentar essa trava explícita antes de ativar.
- A identificação automática por equivalência exata encontrou candidato em apenas 1 dos 21 casos editoriais de duplicata; isso não mede o desempenho de toda a deduplicação em produção. Falta testar agrupamento de episódio e escolha da fonte canônica separadamente.
- Corrigir primeiro validação do nome e detecção de listagens; depois etapa/categoria e múltiplos atos. Repetir a simulação e acrescentar amostra nova, ainda não usada para ajustar regras. **Não ativar agora.**
