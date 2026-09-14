# Pesquisa e validação das fontes do Radar Consórcios

## Escopo e evidências

A ampliação combina descoberta de notícias, leitura de portais institucionais e consulta a normas municipais. A validação foi realizada em 14 de setembro de 2026, com requisições HTTP reais, execução dos parsers, revisão de candidatos e testes de regressão. Foram usadas janelas de sete, quatorze e 45 dias. As janelas maiores servem para homologar fontes com baixa frequência; não significam uma coleta retrospectiva completa. Páginas e feeds podem expor apenas suas últimas publicações.

O propósito editorial permanece identificar criação, entrada e saída de municípios, protocolos, rateio, governança, crises, fiscalização e ações relevantes de consórcios públicos. Conteúdos comerciais, concursos, atas de preços, simples convocações e tabelas contábeis não devem ser transformados automaticamente em acontecimentos institucionais.

## Validação no GitHub Actions

Validação de produção concluída: [coleta e envio 34890080312](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/34890080312) coletou 74 registros, consolidou 69 URLs únicas e enviou a notícia do CONIAPE. O estado gravado contém versão 4, histórico de coleta e fila vazia após a confirmação. A fonte QD falhou nessa execução e a limitação foi registrada.

O [teste do resumo 34890156509](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/34890156509) enviou um boletim identificado como prévia para o grupo de teste. A [repetição 34890287847](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/34890287847) concluiu com a indicação de resumo já enviado e não repetiu a mensagem. A suíte foi ampliada para 54 testes, incluindo abertura, repetição e encerramento de incidentes com API simulada. Os testes de alerta não enviam notificações fictícias.

A execução [34889843638](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/34889843638) passou em 53 testes e completou a coleta em prévia: 71 registros e um candidato relevante, a parceria do CONIAPE. RNCP e CISAMAPI, apesar do sucesso local, retornaram HTTP 403 nesse ambiente. Seus acessos diretos foram então desativados na configuração de produção e mantidos como adaptadores disponíveis. Foram acrescentadas buscas específicas para CISAMAPI e TCE-PR no Google. A RNCP já tinha busca específica. As conclusões locais da tabela abaixo não equivalem a homologação no Actions.

## Resultado por fonte

| Fonte e interface testada | Resultado observado | Decisão e limite |
|---|---|---|
| [Querido Diário — API atual](https://queridodiario.ok.org.br/api/gazettes) | Respondeu com 21 documentos em duas coletas; em outras houve HTTP 503 e timeout | Endereço corrigido, tentativas limitadas e diagnóstico por consulta. Continua instável; recuperação não é garantia de disponibilidade |
| [QD — endereço antigo](https://api.queridodiario.ok.org.br/docs) | Falha de negociação TLS | Deixou de ser o endereço utilizado. Não se desativou validação de certificado |
| [RNCP](https://www.rncp.org.br/noticias) | HTTP 200 local; duas notícias na janela ampliada; HTTP 403 no Actions | Tentativa de reativação revertida na configuração de produção. Cobertura via Google |
| [CNM](https://cnm.org.br/areas_tecnicas/consorcios/noticias) | HTTP 403 com página de proteção | Mantida descoberta pelo Google; sem contornar proteção |
| [TCE-MG](https://www.tce.mg.gov.br/noticia) | Extração de 20 notícias na amostra final; seleção depende do conteúdo | Mantido. A página pode mudar durante a pesquisa, e o primeiro lote não representa todo o arquivo |
| [TCE-SP](https://www.tce.sp.gov.br/noticias) | HTTP 200; sete notícias na janela de sete dias e oito na ampliada | Adaptador novo, com data do card e leitura de texto. Clipping lateral não é misturado às notícias do tribunal |
| [TCE-PR](https://www.tce.pr.gov.br/imprensa/noticias/) | HTTP 200, mas listagem entregue como estrutura a preencher por JavaScript/Lumis; `/feed/` respondeu 404 | Não homologado como scraper. Necessita interface pública estável ou adaptador específico; não tratado como fonte saudável com zero notícias |
| [CISAMAPI](https://www.cisamapi.mg.gov.br/noticias) | Três itens localmente; eleição de 04/09 validada; HTTP 403 no Actions | Adaptador novo disponível, desativado em produção. A seleção do corpo foi corrigida; cobertura alternativa via Google |
| [CONIAPE](https://consorcioconiape.pe.gov.br/feed/) | RSS válido, duas notícias recentes; parceria publicada em 10/09 | Feed novo com leitura complementar do artigo. Expande a cobertura para Pernambuco |
| [CIGA](https://consorciociga.gov.br/feed/) | RSS válido; itens recentes incluem tutoriais administrativos | Integrado com filtro editorial. Volume de itens não representa rendimento noticioso |
| [CISREC](https://cisrec.mg.gov.br/feed/) | RSS válido, última entrada observada em março de 2026 | Integrado como fonte de baixa frequência. Zero na janela recente é ausência no feed, não prova de ausência de atividade institucional |
| [SAPL Unaí](https://sapl.unai.mg.leg.br/api/norma/normajuridica/) | API JSON válida; uma norma na janela ampliada filtrada | Integrado para normas publicadas; propostas legislativas não são confundidas com leis |
| [SAPL São João da Boa Vista](https://sapl.saojoaodaboavista.sp.leg.br/api/norma/normajuridica/) | API JSON válida; seis normas na janela ampliada, uma relevante | Integrado. Exemplo: Lei 5.651/2026, sobre alterações do contrato e estatuto do CEMMIL |
| [SAPL Rio Negro](https://sapl.rionegro.pr.leg.br/) | Consulta da API falhou no teste direto | Não habilitado |
| [CIMVALPI](https://www.cimvalpi.mg.gov.br/feed/) | HTTP 403 | Não habilitado |
| [CIMCERO](https://consorciopublico.ro.gov.br/feed/) | HTTP 200 com HTML de aplicação, não RSS | Não cadastrado como feed. O parser agora rejeita esse tipo de falso sucesso |
| [CONISUD](https://conisud.sp.gov.br/noticias) | HTML público com cards Joomla/K2 e datas em português | Candidato para próxima onda, ainda sem adaptador homologado |
| [Grande ABC](https://www.consorcioabc.sp.gov.br/) | Portal público acessível; notícias institucionais e programação cultural misturadas | Cobertura via Google preservada; não se adicionou raspagem ampla sem separação editorial |
| [CIGIRS](https://cigirs.go.gov.br/feed/) | Feed acessível com indícios de conteúdo demonstrativo | Não habilitado |

Os testes ampliados dos adaptadores retornaram 34 itens de portais, 26 de RSS e sete normas SAPL. Esses números são contagens de registros disponíveis, não de eventos únicos ou notícias relevantes. O relatório reproduzível é gerado por `node scripts/validate-sources.mjs`, em `output/source-validation.json`.

## Bases nacionais pesquisadas

O [GDELT DOC 2.0](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) oferece busca de cobertura jornalística. A consulta realizada retornou HTTP 429. Não foi ativado para publicação. Uma integração futura precisa limitar a frequência, tratar limites da API e verificar datas e fontes originais; não cabe chamá-lo junto a todas as consultas horárias sem controle.

O [PNCP](https://www.gov.br/pncp/pt-br/central-de-conteudo/manuais/versoes-anteriores/ManualPNCPAPIConsultasVerso1.0.pdf) possui consulta de contratações por período e filtros de órgão. O manual vinculado é uma versão anterior, usada apenas para identificar a família de interface. Não houve homologação operacional do PNCP nesta entrega. Contratações por um consórcio indicam atividade, mas não provam criação de entidade ou adesão de municípios. É necessário primeiro um cadastro confiável de CNPJs e regras próprias para atos de contratação.

A página oficial de [dados abertos do Transferegov](https://www.gov.br/transferegov/pt-br/ferramentas-gestao/dados-abertos) informa migração da maioria das APIs para [api-publica.transferegov.gestao.gov.br](https://api-publica.transferegov.gestao.gov.br). Reutilizar endereços antigos sem conferência reproduziria o problema do Querido Diário. A integração financeira fica pendente de validação de contratos, atualização e identificação das entidades.

O [projeto principal de dados territoriais](https://github.com/driano1221/consorcios-mg-dados-territorio) foi consultado. O inventário Git disponível contém evidências e revisões documentais, mas não foi importado como cadastro nacional completo. Foram cadastradas apenas duas identidades institucionais verificadas para melhorar o reconhecimento das siglas CISAMAPI e CONIAPE. A resolução de centenas de entidades e suas mudanças históricas permanece uma etapa própria.

## Repositórios e decisões de arquitetura

| Projeto | Utilidade para o radar | Decisão |
|---|---|---|
| [RSSHub](https://github.com/DIYgod/RSSHub) | Referência para adaptadores que convertem diferentes sites em feeds | Manter adaptadores pequenos no projeto; não criar dependência de instância pública de terceiros |
| [RSS-Bridge](https://github.com/RSS-Bridge/rss-bridge) | Modelo de extração por site e seletor | Adotar parsers específicos e falha explícita quando o layout muda |
| [changedetection.io](https://github.com/dgtlmoon/changedetection.io) | Monitoramento de alterações em páginas e seções | Útil futuramente para transparência e legislação sem feed; não instalado como serviço permanente nesta entrega |
| [NewsFlow-Bot](https://github.com/Lynthar/NewsFlow-Bot) | Referência de agregação, filtros, mensagens e resumos | Separar coleta, histórico, resumo e entrega. Não importar funcionalidades de IA ou tradução sem necessidade |
| [SAPL](https://github.com/interlegis/sapl) | Sistema original das APIs legislativas municipais | Preferir JSON de normas a raspagem de resultados de busca; validar cada instalação |
| [querido-diario-api](https://github.com/okfn-brasil/querido-diario-api) | Fonte primária da indicação do novo endereço | Corrigir endpoint e validar contrato de resposta |

Não foi necessária migração para n8n, servidor permanente ou API de modelo. O sistema continua com Node.js e GitHub Actions. A pesquisa orientou mudanças concretas: dados estruturados antes de HTML, falhas por fonte, histórico separado do envio, leitura do artigo quando o feed é insuficiente e resumo com rastreabilidade.

## Correções editoriais verificadas

| Antes | Depois |
|---|---|
| “Consórcios públicos” podia perder o reconhecimento institucional por estar no plural | Plurais reconhecidos e protegidos por teste |
| Podcast do TCE-SP era classificado como fiscalização por mencionar Tribunal de Contas | Menção ao órgão não basta; são exigidos sinais de ação de controle |
| Convocação do CIMCERO virava decisão de governança | Convocação sem decisão é descartada |
| Suspensão de seleção de pessoal aparecia como fiscalização | Recrutamento fora do foco é excluído |
| Tabelas de despesas com pessoal e listas de subvenções viravam novos contratos de rateio | Demonstrativos contábeis e listagens genéricas são rejeitados |
| Fragments de OCR podiam virar siglas como “GAIS” ou “EXECU” | Siglas exigem contexto e delimitadores; descrição genérica quando incerta |
| Proposta de ingresso de Valinhos aparecia como autorização de adesão | A mensagem informa proposta e ressalva que o trecho não comprova efetivação |
| Parágrafos HTML colados prejudicavam o resumo | Separação de blocos preservada antes da extração de frases |
| Fonte que respondia HTML com status 200 era contada como RSS saudável | Estrutura RSS/Atom validada; falha sinalizada |

Exemplos de verificação: [proposta de ingresso de Valinhos](https://data.queridodiario.ok.org.br/3556206/2026-09-11/99545b3eba67d73579910c843a307e824498dfe8.pdf), [eleição do CISAMAPI](https://www.cisamapi.mg.gov.br/noticia/geral/04-09-2026/5742/cisamapi-elege-nova-presidencia-para-o-bienio-2027-2028), [parceria do CONIAPE](https://consorcioconiape.pe.gov.br/2026/09/10/coniape-firma-parceria-com-o-ministerio-da-agricultura-e-pecuaria-do-governo-federal/) e [norma de São João da Boa Vista](https://sapl.saojoaodaboavista.sp.leg.br/norma/12193).

## Resumo de sábado e histórico

O workflow semanal tenta enviar às 9h de sábado, horário de Brasília. Uma segunda execução às 12h verifica o mesmo identificador semanal e não reenvia quando já existe confirmação. Ambas cobrem o período do sábado anterior às 9h até o sábado corrente às 9h. Atrasos do agendador do GitHub são possíveis; o horário é de agendamento, não garantia de entrega exata.

São contadas publicações encontradas pela primeira vez no período, com datas das fontes mantidas nos destaques. Por isso uma notícia publicada antes do início da semana pode aparecer se tiver sido descoberta agora. Contagens não somam novamente a mesma URL em cada coleta. O resumo inclui achados relevantes, inclusive os não enviados individualmente, os ainda em fila, fontes, categorias e falhas de cobertura. O histórico inicial é explicitamente parcial; não foram inventadas observações anteriores à implantação.

O estado guarda 60 dias de observações e execuções. O histórico de mensagens enviadas mantém a retenção anterior. A fila mantém candidatos por até 30 dias. O resumo e seu identificador são gravados antes da tentativa de envio e confirmados após a resposta da biblioteca. Uma interrupção entre o envio remoto e a persistência ainda impede uma garantia absoluta de entrega exatamente uma vez; o identificador estável reduz esse risco.

O destino usa `WHATSAPP_WEEKLY_GROUP_ID`, quando configurado, ou o grupo existente. A implantação mantém o grupo de teste. O grupo dos chefes não foi presumido nem substituído. O formato segue [negrito, listas e citações documentados pelo WhatsApp](https://faq.whatsapp.com/general/chats/how-to-format-your-messages/?lang=pt_br). A prévia HTML é uma simulação visual, não uma captura do aplicativo WhatsApp.

## Operação, alertas e custo

O radar continua de hora em hora, minuto 17, com até três notícias por rodada e 72 por dia. A janela de descoberta passou de 96 para 168 horas para tolerar finais de semana, indexação tardia e interrupções curtas. A checagem independente da sessão permanece diária às 8h41.

Falhas de execução e problemas de sessão abrem uma ocorrência no próprio GitHub. Fontes precisam acumular três falhas consecutivas para gerar alerta de cobertura. A ocorrência é reaproveitada enquanto a condição permanece e encerrada na recuperação. Isso evita depender do próprio WhatsApp para avisar que ele desconectou. Receber e-mail ou aviso no celular depende das preferências de notificação do GitHub. Não foi configurado outro canal pessoal.

Os workflows compartilham o grupo de concorrência da sessão. Os relatórios de coleta ficam como artefatos por sete dias; os resumos, por 14. Credenciais não são incluídas nos artefatos. Os dados SAPL armazenados são uma lista explícita de campos documentais; IPs e identificadores de usuários da API não são copiados.

O repositório foi confirmado como público. O GitHub informa que minutos de runners padrão são gratuitos nesse caso; armazenamento de artefatos e caches tem regras próprias. A retenção curta e arquivos de texto pequenos limitam o consumo. Nenhuma ferramenta paga foi adicionada. Ver [documentação de cobrança do GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Limitações e próximos passos

A amostra e os testes protegem casos concretos, mas não demonstram precisão nacional de 95% ou cobertura exaustiva. TCE-PR, CNM direta, GDELT e demais bases financeiras não são integrações concluídas. O Querido Diário permanece oscilante, mesmo com o endereço correto. A API sinaliza página cheia como cobertura parcial; paginação adicional exige homologação do contrato atual.

A deduplicação combina URL, título e semelhança textual. Ela ainda não equivale a um registro completo de eventos por CNPJ, município e ato. O cadastro amplo do projeto principal continua prioritário para uma próxima expansão. Também não há watchdog externo capaz de alertar se o próprio GitHub Actions parar de executar todos os workflows.

As próximas decisões devem usar o histórico real: taxa de achados por fonte, erros persistentes, amostras de falsos positivos e retorno do primeiro sábado. Uma fonte pouco produtiva não deve ser compensada com redução indiscriminada do limiar editorial.
