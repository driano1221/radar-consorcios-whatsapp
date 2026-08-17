# Memória do projeto — Radar de Consórcios

Atualizado em 14 de agosto de 2026.

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

- Google News RSS com 17 consultas específicas.
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

- 26 testes automatizados aprovados.
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

- Scrapers leves foram implementados com `publish: false`; eles não enviam mensagens ao WhatsApp durante a homologação.
- Cada portal possui parser isolado, timeout, uma nova tentativa, `User-Agent` identificável e detecção básica de mudança de layout.
- A primeira coleta real dos scrapers observou três itens dentro da janela: duas notícias do TCE-MG e o índice da edição da AMM-MG.
- Uma notícia do TCE-MG sobre suspensão de licitação do Ciminas atingiu 11 pontos e foi corretamente retida como candidato de CONTROLE em prévia.
- A outra notícia do TCE-MG, sem relação com consórcios, foi descartada pelo classificador.
- RNCP e CNM estavam acessíveis, mas não tinham item dentro das 96 horas da coleta.
- O Diário Municipal não é pesquisado por formulário porque existe CAPTCHA; o radar não tenta contorná-lo. O protótipo apenas monitora a edição e não trata um PDF inteiro como notícia.
- Saídas de auditoria: `output/scraper-observations.json`, `output/scraper-candidates.json`, `output/scraper-health.json` e `output/scraper-preview.txt`.
- Próxima decisão: observar os resumos do Actions e somente mudar `webScrapers.publish` para `true` após confirmar estabilidade e qualidade.

## Arquivos centrais

- `src/radar.mjs`: orquestra coleta, seleção, envio e persistência.
- `src/lib/classifier.mjs`: classificação e pontuação.
- `src/lib/dedupe.mjs`: deduplicação e histórico.
- `src/lib/format.mjs`: apresentação das mensagens.
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
