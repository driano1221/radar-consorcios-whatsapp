# Memória do projeto — Radar de Consórcios

Atualização mais recente: **14 de outubro de 2026**. As primeiras seções são um registro histórico da implantação original; números, agendas e decisões antigas nelas descritos foram substituídos pelas atualizações datadas. Para operação corrente, use também o [README principal](../README.md) e os workflows versionados.

Este documento registra o contexto, as decisões e o estado operacional do projeto para que o trabalho possa ser retomado sem depender do histórico da conversa. Ele não contém telefone, ID do grupo, senha ou material de autenticação aberto.

## Ponto de retomada — 14/10/2026

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
