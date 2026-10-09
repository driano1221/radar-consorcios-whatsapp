# Memória do projeto — Radar de Consórcios

Atualizado em 14 de setembro de 2026. As primeiras seções registram a implantação original; as atualizações datadas ao final indicam as mudanças posteriores.

Este documento registra o contexto, as decisões e o estado operacional do projeto para que o trabalho possa ser retomado sem depender do histórico da conversa. Ele não contém telefone, ID do grupo, senha ou material de autenticação aberto.

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
