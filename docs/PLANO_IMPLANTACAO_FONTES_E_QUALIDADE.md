# Plano de implantação — fontes, qualidade e resumo semanal

## Atualização de implantação — 14/09/2026

- Observabilidade e regressões: ampliadas; saúde por feed/consulta e alertas via GitHub.
- Classificador: correções adicionais de plurais, convocações, recrutamento, demonstrativos e propostas de ingresso.
- Fontes: QD com endpoint atual (ainda instável), TCE-SP e três RSS adicionados; duas instâncias SAPL integradas. RNCP/CISAMAPI passaram localmente, mas recebem HTTP 403 no Actions: coleta direta desativada e cobertura via Google.
- Histórico e fila: observações e execuções por 60 dias, fila por 30 dias, resumo separado do histórico de envios.
- Resumo semanal: implementado para **sábado às 9h**, substituindo a proposta anterior de segunda-feira; retentativa ao meio-dia com deduplicação semanal. Destino inicial de teste.
- Pendências: TCE-PR direto, CNM direta, cadastro amplo e identidade jurídica dos eventos, fontes financeiras nacionais e IA opcional. Não foram declaradas concluídas.

Evidências e critérios: [pesquisa e validação de setembro](PESQUISA_E_VALIDACAO_2026-09-14.md). As fases descritas abaixo são o plano histórico e não substituem este status atualizado.

**Projeto:** Radar Consórcios — WhatsApp
**Atualizado em:** 21 de agosto de 2026
**Objetivo:** reduzir o viés do Querido Diário, aumentar a cobertura de eventos relevantes sobre consórcios públicos e preservar precisão, deduplicação, custo zero e operação no GitHub Actions.

**Status de execução (21/08/2026):** Fases 0, 1 e 2 foram implementadas e homologadas no GitHub Actions (execuções #167 e #168, ambas concluídas com sucesso). O TCE-MG foi habilitado isoladamente para publicação; as demais fontes de scraping continuam em prévia. A Fase 1 permanece em observação por 24–48 horas.

## 1. Resumo executivo

A implantação deve ocorrer nesta ordem:

1. **Criar uma linha de base e testes de regressão.**
2. **Corrigir o classificador**, especialmente os falsos positivos vindos do Querido Diário.
3. **Recuperar e homologar as fontes já implementadas**, começando pelo TCE-MG e pelo Google Notícias.
4. **Criar um modelo persistente de eventos e uma fila**, para que notícias não selecionadas não se percam e fontes diferentes sejam consolidadas.
5. **Integrar o cadastro de consórcios e aliases** do projeto principal.
6. **Adicionar novas fontes oficiais em ondas**, começando por tribunais de contas, SAPL e portais dos próprios consórcios.
7. **Criar o resumo semanal de segunda-feira**, apoiado no histórico completo de observações.
8. **Adicionar fontes analíticas nacionais** em rotinas diárias, semanais ou mensais.
9. **Avaliar IA somente depois da estabilização**, como revisora de casos limítrofes, nunca como publicadora autônoma.

### Prazos de referência

| Entrega | Esforço técnico líquido | Prazo de calendário recomendado | Dificuldade |
|---|---:|---:|---:|
| MVP anti-viés | 5–7 dias úteis | 1,5–2 semanas | Alta |
| Versão robusta, com fila, cadastro, novas fontes e resumo semanal | 10–15 dias úteis | 3–4 semanas | Alta |
| Cobertura nacional e fontes analíticas | 18–25 dias úteis no total | 5–7 semanas | Muito alta |

Os prazos de calendário incluem períodos de observação em modo de prévia. A estimativa pressupõe uma pessoa familiarizada com o repositório, sem atrasos de acesso externo e com testes incluídos.

## 2. Diagnóstico que orienta o plano

### 2.1 Viés confirmado

No estado analisado, 29 de 30 mensagens publicadas vieram do Querido Diário: **96,7%**. Isso não significa que a fonte esteja errada; significa que a arquitetura atual favorece documentos do Querido Diário em relação às demais fontes.

Na execução analisada de 21/08/2026:

| Origem | Itens coletados | Relevantes após o filtro | Observação |
|---|---:|---:|---|
| Google Notícias | 20 | aproximadamente 1 publicável | Domínio original não é aproveitado corretamente |
| Querido Diário | 37 | aproximadamente 17 publicáveis | Texto longo e bônus de pontuação favorecem a origem |
| RSS | 17 | 0 | Feeds amplos e pouco orientados a eventos |
| Scrapers | 7 | 1 | Permanecem em modo de prévia e não podem publicar |

### 2.2 Causas técnicas principais

- O Querido Diário recebe bônus de origem e oferece trechos muito maiores que outras fontes.
- Trechos distintos de um mesmo diário podem ser unidos e produzir uma coincidência artificial de palavras-chave.
- Termos como “protocolo”, “adesão” e “consórcio” aparecem em contextos sem relação com criação, entrada, saída ou governança de consórcios públicos.
- O filtro negativo cobre “adesão a ata”, mas não todas as variantes, como “adesão de ata”, ARP e “órgão não participante”.
- O parser do Google Notícias não preserva adequadamente o domínio informado no campo `source`, perdendo um sinal importante de confiança.
- Não existe ainda um cadastro operacional de entidades e aliases para reconhecer nomes reais de consórcios.
- Os scrapers estão configurados com `publish: false`.
- A seleção usa pontuação global, sem separar claramente relevância, confiança, importância e diversidade.
- Não há fila persistente de candidatos; itens não selecionados dependem de serem redescobertos antes de expirar.
- A deduplicação atual é centrada em URL e título, não na identidade do evento.

### 2.3 Risco operacional

As execuções de envio analisadas registraram dezenas de erros de sessão do Baileys/libsignal, como `MessageCounterError` e `Bad MAC`. Os envios ainda funcionam, mas algumas execuções chegaram perto do limite atual de tempo. A expansão de fontes deve incluir telemetria da sessão, isolamento de falhas e aumento controlado do timeout.

## 3. Arquitetura-alvo

```text
Descoberta
  -> hidratação do conteúdo
  -> resolução da entidade
  -> extração do evento
  -> validação e confiança
  -> deduplicação/corroboração entre fontes
  -> fila persistente
  -> seleção editorial
  -> WhatsApp diário
  -> resumo semanal
```

Cada fase deve produzir um objeto padronizado, para que uma nova fonte não precise reimplementar classificação, deduplicação ou formatação.

### 3.1 Contrato mínimo de uma observação

```json
{
  "sourceId": "tce-mg",
  "sourceType": "control_body",
  "sourceUrl": "https://...",
  "canonicalUrl": "https://...",
  "title": "...",
  "publishedAt": "2026-08-21T00:00:00-03:00",
  "collectedAt": "2026-08-21T11:00:00-03:00",
  "text": "...",
  "entityCandidates": [],
  "eventCandidates": [],
  "sourceTrust": 0.9
}
```

### 3.2 Contrato mínimo de um evento

```json
{
  "eventId": "sha256-da-identidade-do-evento",
  "eventType": "ADESAO",
  "consortiumId": "cnpj-ou-id-interno",
  "municipalityIds": [],
  "actNumber": "4497/2026",
  "actDate": "2026-08-11",
  "relevance": 0.96,
  "confidence": 0.94,
  "importance": 0.72,
  "status": "queued",
  "observations": []
}
```

`relevance`, `confidence` e `importance` devem permanecer separados. Uma notícia pode ser relevante, mas pouco confiável; pode ser confiável, mas de baixa importância. Diversidade de fontes só entra depois desses três filtros e nunca deve promover conteúdo fraco.

## 4. Ordem detalhada de implantação

### Fase 0 — Linha de base, segurança e observabilidade

**Ordem:** 1
**Esforço:** 0,5–1 dia útil
**Dificuldade:** 2/5 — baixa
**Homologação:** imediata, sem publicação adicional

#### Implementar

- Congelar exemplos reais de verdadeiros positivos, falsos positivos e falsos negativos em fixtures de teste.
- Registrar o funil por fonte:
  - coletados;
  - descartados por idade;
  - descartados por contexto;
  - classificados;
  - enfileirados;
  - publicados;
  - duplicados;
  - erros e duração.
- Registrar os principais motivos de descarte, sem expor segredos.
- Criar métricas de concentração por fonte para 24 horas, 7 dias e 30 dias.
- Aumentar o timeout do workflow de envio para 8–10 minutos como margem de segurança, mantendo alertas de duração.
- Separar tarefas leves, executadas de hora em hora, de coletas pesadas diárias ou semanais.
- Criar feature flags por família de fonte e manter novas fontes em `publish: false`.

#### Critérios de aceite

- Uma execução mostra o funil completo de cada origem.
- É possível explicar por que um item foi descartado ou publicado.
- Os exemplos atualmente conhecidos viram testes reproduzíveis.
- Nenhuma nova fonte publica durante esta fase.

### Fase 1 — Correção do motor de relevância

**Ordem:** 2
**Esforço:** 1,5–2,5 dias úteis
**Dificuldade:** 4/5 — alta
**Homologação:** 24–48 horas em prévia

#### Implementar

- Classificar cada trecho do Querido Diário separadamente antes de consolidar o documento.
- Exigir proximidade textual entre:
  - entidade consorcial;
  - ação relevante;
  - município ou órgão;
  - ato, quando aplicável.
- Expandir exclusões para compras e atas:
  - adesão a/de ata;
  - ata de registro de preços;
  - ARP;
  - carona;
  - órgão não participante;
  - intenção de registro de preços.
- Diferenciar “protocolo de intenções” de protocolo administrativo genérico.
- Exigir contexto institucional para tipos sensíveis como `PROTOCOLO`, `ADESAO` e `SAIDA`.
- Remover o bônus fixo de origem ou convertê-lo em confiança explícita, calibrada pela qualidade da evidência.
- Separar a pontuação em relevância, confiança e importância.
- Criar limiares distintos:
  - publicação automática;
  - fila para revisão/prévia;
  - descarte.

#### Casos de regressão obrigatórios

- Não classificar o protocolo Urban95 de Maracaju como evento consorcial.
- Não classificar protocolo de incentivo ou cessão de imóvel empresarial de Apucarana.
- Não tratar adesão a/de ata como ingresso em consórcio.
- Continuar identificando leis de ratificação, entrada, saída, criação, dissolução e contratos de rateio.

#### Critérios de aceite

- Todos os falsos positivos conhecidos ficam bloqueados.
- Todos os verdadeiros positivos usados como fixture continuam detectados.
- Em amostra manual rotulada, a precisão-alvo é de pelo menos 95% para publicação automática.
- Casos incertos vão para prévia; não são publicados apenas para aumentar diversidade.

### Fase 2 — Recuperação das fontes atuais

**Ordem:** 3
**Esforço:** 1–1,5 dia útil
**Dificuldade:** 3/5 — média
**Homologação:** 24–48 horas em prévia; ativação de uma origem por vez

#### Implementar

- Trocar o endpoint antigo/filtrado do TCE-MG pela página canônica de notícias.
- Corrigir seletores e extrair data, título, link e texto suficiente para classificação.
- Preservar o domínio original do campo `source` no Google Notícias.
- Usar o domínio original como sinal de confiança, sem considerar isso prova isolada.
- Substituir RSS amplos que não produzem eventos por consultas e feeds dirigidos.
- Adicionar diagnóstico de seletor vazio, mudança de layout, HTTP, timeout e bloqueio.
- Manter o TCE-MG e outros scrapers em prévia até a validação manual.
- Depois da homologação, habilitar primeiro o TCE-MG e só então outras origens.

#### Resultado esperado

O TCE-MG canônico já apresentou casos relevantes de Cimcentral, Ciminas e Cisrec. Essa é a correção com melhor relação entre esforço, qualidade e diversidade imediata.

#### Critérios de aceite

- Os três exemplos relevantes identificados no TCE-MG aparecem na prévia.
- O Google registra e pontua o domínio original.
- Falha em um scraper não interrompe as outras fontes.
- Cada seletor tem fixture ou teste de parser.
- A publicação permanece condicionada ao nível de confiança, não à necessidade de balancear fontes.

### Fase 3 — Cadastro de entidades, modelo de eventos, fila e deduplicação

**Ordem:** 4
**Esforço:** 2,5–4 dias úteis
**Dificuldade:** 4/5 — alta
**Homologação:** 2–3 dias com migração e comparação paralela

#### Implementar

- Criar um cadastro operacional com:
  - ID estável;
  - CNPJ;
  - nome oficial;
  - siglas;
  - aliases históricos;
  - UF;
  - municípios conhecidos;
  - URLs oficiais;
  - evidências e datas de validade.
- Usar como semente o repositório principal `consorcios-mg-dados-territorio`, que contém cerca de 223 CNPJs de consórcios mineiros.
- Exportar apenas os campos necessários ao radar; não copiar bases privadas ou pesadas sem revisão.
- Resolver aliases de forma conservadora e registrar ambiguidades.
- Criar uma identidade de evento baseada, quando disponível, em:
  - consórcio/CNPJ;
  - município;
  - tipo de ação;
  - número e data do ato;
  - período do evento.
- Criar fila persistente com estados:
  - `discovered`;
  - `validated`;
  - `queued`;
  - `sent`;
  - `expired`;
  - `rejected`.
- Migrar o histórico atual sem reenviar mensagens antigas.
- Consolidar várias observações do mesmo evento em um único alerta com fontes corroborantes.
- Manter URL e título como sinais auxiliares, não como identidade principal.
- Definir expiração por tipo de evento; atos legais podem permanecer úteis por mais tempo que notícias comuns.

#### Critérios de aceite

- Uma notícia que não entrou no limite diário permanece na fila elegível.
- Duas fontes sobre o mesmo ato geram uma mensagem, com fontes consolidadas.
- Uma alteração de URL ou título não provoca reenvio do mesmo evento.
- A migração não republica os 30 itens já enviados.
- O cadastro resolve corretamente os aliases presentes nas fixtures.

### Fase 4 — Expansão de fontes oficiais em ondas

**Ordem:** 5
**Esforço:** 3–5 dias úteis
**Dificuldade:** 4/5 — alta
**Homologação:** 3–7 dias em prévia por onda

#### Onda A — Tribunais de contas

Prioridade:

1. TCE-MG já corrigido.
2. TCE-SP.
3. TCE-PR.
4. Outros TCEs somente após comprovar rendimento e manutenção aceitáveis.

Criar um contrato comum de adaptador e testes por tribunal. Não tentar um scraper universal; portais públicos variam demais.

#### Onda B — SAPL/Interlegis

O SAPL é especialmente valioso para:

- projetos de lei e leis de ratificação;
- criação e alteração de protocolos de intenções;
- adesão e retirada de municípios;
- alterações estatutárias e autorizações legislativas.

Começar por municípios e câmaras associados às entidades do cadastro. Descobrir instâncias de forma controlada, limitar concorrência e armazenar cursores por portal.

#### Onda C — Portais oficiais dos consórcios

- Fazer autodetecção de RSS, Atom, sitemap e WordPress.
- Preferir feeds e dados estruturados antes de HTML.
- Usar JSON-LD quando disponível.
- Aplicar detecção de mudança somente nas seções relevantes: notícias, transparência, assembleias e legislação.
- Criar teste de saúde de seletor e assinatura do conteúdo para perceber redesigns.

#### Critérios de aceite

- Cada adaptador falha isoladamente.
- Cada fonte informa última coleta bem-sucedida, quantidade e erro mais recente.
- Uma origem só passa de prévia para publicação após amostra manual suficiente.
- A concentração do Querido Diário deve cair como consequência de eventos válidos adicionais, nunca por cota artificial.
- Meta operacional inicial: nenhuma origem concentrar mais de 70% dos eventos confirmados numa janela de duas semanas, desde que existam alternativas qualificadas no período.

### Fase 5 — Resumo semanal de segunda-feira

**Ordem:** 6
**Esforço:** 1,5–2 dias úteis
**Dificuldade:** 3/5 — média
**Homologação:** uma segunda-feira em grupo de teste

#### Dependência

Esta fase depende do armazenamento persistente de **todas as observações e eventos**, não apenas das mensagens enviadas. Sem isso, o resumo seria somente uma repetição do WhatsApp diário e perderia achados que ficaram na fila.

#### Implementar

- Criar workflow semanal, preferencialmente na segunda-feira pela manhã.
- Serializar o workflow semanal com o mesmo grupo de concorrência do envio diário, evitando duas sessões simultâneas do WhatsApp.
- Criar segredo separado: `WHATSAPP_WEEKLY_GROUP_ID`.
- Enviar primeiro para o grupo `Radar Consórcios - Teste`.
- Gerar uma única mensagem bem formatada com:
  - período coberto;
  - total de observações;
  - total de eventos confirmados;
  - criação, adesão, saída, dissolução, rateio, protocolo e controle;
  - estados e municípios mais presentes;
  - principais achados;
  - itens ainda em acompanhamento;
  - distribuição por fonte;
  - indicador de concentração das fontes;
  - falhas de coleta relevantes.
- Escolher os destaques por importância e confiança, sem repetir versões duplicadas do mesmo evento.
- Prever divisão controlada em duas mensagens somente quando o limite do WhatsApp exigir.

#### Critérios de aceite

- O resumo reflete todos os eventos da semana, inclusive os não enviados diariamente.
- Os totais podem ser reconciliados com o estado persistente.
- Não há duplicidade de evento nos destaques.
- O grupo do IPEA somente é configurado depois da aprovação visual no grupo de teste.

### Fase 6 — Fontes analíticas nacionais

**Ordem:** 7
**Esforço:** 5–8 dias úteis
**Dificuldade:** 4–5/5 — alta a muito alta
**Homologação:** 1–2 semanas, com frequências distintas

#### Prioridade sugerida

1. **GDELT DOC 2.0:** descoberta complementar de notícias, com consulta gratuita e sem chave; usar como fallback, não como prova final.
2. **PNCP:** atividade de contratação por CNPJs conhecidos; útil como sinal de atividade, mas não como prova de adesão ou composição jurídica.
3. **Transferegov:** transferências e convênios envolvendo consórcios; validar a atualização real dos arquivos antes de tratá-los como tempo real.
4. **TCU — dados de jurisprudência:** rotina semanal para decisões relevantes.
5. **Receita Federal — dados abertos de CNPJ:** atualização mensal para detectar novas entidades e alterações cadastrais nas naturezas jurídicas pertinentes.
6. **LexML:** descoberta legislativa complementar, somente depois de validar uma interface estável e sustentável.

#### Frequência recomendada

| Fonte | Frequência | Motivo |
|---|---|---|
| Google, QD, TCE prioritários | Horária | Eventos recentes e coleta leve |
| SAPL e portais oficiais | 2–4 vezes ao dia | Evita sobrecarga e reduz minutos do Actions |
| GDELT e PNCP | Diária | Descoberta e atividade analítica |
| Transferegov e TCU | Semanal | Atualização menos urgente |
| Receita Federal | Mensal | Base pesada e atualização cadastral |

#### Critérios de aceite

- Cada fonte tem finalidade editorial documentada.
- Dados de contratação não são transformados indevidamente em eventos de adesão.
- Arquivos grandes usam workflow separado, cache e artefatos compactos.
- O consumo mensal do GitHub Actions permanece acompanhado e dentro da franquia disponível.

### Fase 7 — IA opcional para revisão assistida

**Ordem:** 8, opcional
**Esforço:** 1–2 dias úteis para um piloto
**Dificuldade:** 3/5 — média
**Custo:** variável; pode deixar de ser zero

#### Recomendação

Não adicionar um agente ou modelo de linguagem antes de concluir as fases determinísticas. IA não corrige uma arquitetura que mistura trechos, perde entidades ou não persiste eventos.

Se houver interesse posterior, limitar o modelo a:

- revisar candidatos na faixa intermediária de confiança;
- produzir uma sugestão de resumo curto;
- apontar campos faltantes;
- agrupar textos possivelmente relacionados para posterior validação determinística.

O modelo não deve:

- buscar e publicar de forma autônoma;
- substituir as regras de evidência;
- decidir ingresso ou saída somente por inferência;
- receber credenciais do WhatsApp;
- publicar diretamente no grupo.

Toda saída deve passar por esquema estruturado, validação, limites de custo e fallback sem IA.

## 5. O que aproveitar de projetos semelhantes

| Projeto/padrão | O que aproveitar | Adotar o sistema inteiro? | Decisão |
|---|---|---:|---|
| changedetection.io | snapshots, assinatura de conteúdo, seletor monitorado e alerta de mudança de layout | Não | Reimplementar apenas os padrões leves no GitHub Actions |
| RSS-Bridge | adaptadores CSS/XPath, saída normalizada e isolamento por fonte | Não | Usar como inspiração para o contrato de adapters |
| RSSHub | rotas por fonte, testes de rota e cache | Não inicialmente | Copiar o padrão de organização, sem manter um servidor |
| Huginn | pipeline descoberta → evento → ação e isolamento de falhas | Não | Exige servidor e banco persistentes; conflita com custo zero |
| Miniflux | filtros, timeout, retenção e deduplicação | Não | Aplicar os conceitos ao coletor existente |
| Baileys | sessão local e envio para grupos | Sim, já usado | Manter, mas melhorar diagnóstico e saúde da sessão |

A direção recomendada é **aprender com esses frameworks, sem instalar uma plataforma pesada**. Isso preserva o GitHub Actions, evita n8n e mantém custo de infraestrutura próximo de zero.

## 6. Componentes e arquivos previstos

Os nomes abaixo são sugestões e podem ser ajustados à estrutura atual.

### Componentes existentes a revisar

- `classifier.mjs`: contexto local, exclusões, confiança e importância.
- `querido-diario.mjs`: separação por trecho e evidências.
- `google-news.mjs`: domínio original e hidratação.
- `web-scrapers.mjs`: contrato de adapters, saúde e ativação gradual.
- `dedupe.mjs`: transição de URL/título para identidade de evento.
- `radar.mjs`: pipeline, fila e seleção editorial.
- workflows do GitHub Actions: frequências, timeouts, concorrência e resumo semanal.

### Novos componentes prováveis

- `source-adapter.mjs`: contrato comum das fontes.
- `source-health.mjs`: métricas e falhas de cada origem.
- `entity-registry.mjs`: resolução de CNPJ, nomes, siglas e aliases.
- `event-extractor.mjs`: produção de eventos estruturados.
- `event-store.mjs`: persistência e migração de estado.
- `event-dedupe.mjs`: identidade e consolidação entre fontes.
- `queue.mjs`: prioridade, expiração e estados.
- `weekly-summary.mjs`: estatísticas, destaques e formatação.
- `data/entity-registry.json`: exportação mínima e versionada do cadastro.
- `test/fixtures/`: páginas e notícias reais sanitizadas.

## 7. Requisitos antes de começar

### Técnicos

- Manter o repositório privado.
- Preservar os segredos existentes do WhatsApp.
- Criar backup versionado do estado antes da migração.
- Definir um formato estável de exportação do cadastro principal.
- Ter fixtures locais para que testes não dependam de sites ao vivo.
- Observar `robots.txt`, termos de uso, limites de requisição e dados pessoais.
- Não contornar CAPTCHA, autenticação ou bloqueios de acesso.

### Para o resumo semanal

- ID do grupo de teste, já existente.
- Posteriormente, ID do grupo do IPEA em `WHATSAPP_WEEKLY_GROUP_ID`.
- Horário aprovado para a segunda-feira.
- Aprovação do formato e da extensão da mensagem.

### Operacionais

- Medir os minutos mensais do GitHub Actions antes e depois de cada onda.
- Guardar artefatos de prévia por tempo suficiente para auditoria.
- Não executar dois processos Baileys simultaneamente com a mesma sessão.
- Documentar procedimento de reparação controlada da sessão se `Bad MAC` persistir.

## 8. Estratégia de ativação e rollback

1. Toda fonte nova entra com publicação desabilitada.
2. A prévia registra o que teria sido enviado e o motivo.
3. Uma amostra é revisada manualmente.
4. A fonte é ativada isoladamente.
5. As métricas são comparadas por 24–72 horas.
6. Em caso de regressão, a feature flag é desligada sem remover dados ou desfazer outras fontes.

Não habilitar várias famílias de fontes no mesmo dia. Isso torna impossível identificar qual mudança causou falsos positivos, lentidão ou duplicatas.

## 9. Indicadores de sucesso

### Qualidade editorial

- Precisão mínima de 95% na faixa de publicação automática da amostra rotulada.
- Zero regressões nos falsos positivos conhecidos.
- Casos de baixa confiança permanecem em prévia ou acompanhamento.

### Cobertura

- Crescimento de eventos confirmados vindos de TCEs, SAPL e portais oficiais.
- Redução natural da concentração do Querido Diário.
- Cobertura mensurada por tipo de evento e UF, não apenas por volume bruto.

### Deduplicação

- Um evento gera uma mensagem, mesmo quando aparece em várias URLs.
- As fontes adicionais aparecem como corroboração.
- Nenhum item enfileirado desaparece apenas por não caber no limite diário.

### Operação

- Falha de uma fonte não impede as demais.
- Execuções horárias permanecem leves; cargas pesadas são separadas.
- Duração, erros de sessão e consumo do Actions são monitorados.
- O resumo semanal é reconciliável com o histórico persistente.

## 10. Cronograma sugerido

### Semana 1 — precisão e ganhos imediatos

- Dia 1: linha de base, fixtures, métricas e timeout.
- Dias 2–3: classificador, contexto local e testes de regressão.
- Dia 4: TCE-MG canônico e domínio original do Google.
- Dia 5: prévia, ajuste de limiares e ativação controlada do TCE-MG.

### Semana 2 — memória estrutural

- Dias 6–8: cadastro de entidades, identidade de evento e fila persistente.
- Dias 9–10: migração, deduplicação entre fontes e testes paralelos.

### Semana 3 — novas fontes e resumo

- Dias 11–13: primeiros adapters TCE/SAPL e portais oficiais.
- Dias 14–15: resumo semanal e homologação no grupo de teste.

### Semanas 4–7 — escala nacional

- Homologar novas ondas sem ativação simultânea.
- Adicionar GDELT, PNCP e Transferegov com finalidade bem delimitada.
- Implantar lotes TCU e CNPJ em rotinas separadas.
- Avaliar IA somente com métricas determinísticas estabilizadas.

## 11. Decisões que não devem ser tomadas agora

- Não instalar n8n, Huginn ou outro servidor apenas para orquestração.
- Não adicionar IA antes de corrigir o classificador, a entidade e a fila.
- Não impor cota de publicação por fonte.
- Não habilitar todos os scrapers simultaneamente.
- Não usar contratação no PNCP como prova de adesão ao consórcio.
- Não confiar em título ou URL como identidade definitiva de evento.
- Não ampliar a frequência de tarefas pesadas para uma hora sem medir custo e duração.
- Não contornar bloqueios técnicos ou jurídicos dos portais.

## 12. Próxima ação recomendada

Iniciar pela **Fase 0 e Fase 1** em uma única entrega: instrumentação, fixtures e correção do classificador. Em seguida, implantar o **TCE-MG canônico** como primeira fonte não-QD a sair do modo de prévia. Essa sequência reduz risco, entrega diversidade rapidamente e cria a base necessária para fila, resumo semanal e expansão nacional.

## 13. Checklist de acompanhamento

- [x] Fase 0 — linha de base, fixtures, telemetria e segurança operacional.
- [ ] Fase 1 — classificador corrigido e homologado; aguardando observação contínua em prévia.
- [x] Fase 2 — TCE-MG e Google corrigidos; TCE-MG habilitado isoladamente e demais scrapers mantidos em prévia.
- [ ] Fase 3 — fila persistente concluída; cadastro de consórcios, aliases e identidade ampliada de eventos ainda pendentes.
- [ ] Fase 4A — TCE-SP e TCE-PR homologados.
- [ ] Fase 4B — primeira onda de instâncias SAPL homologada.
- [ ] Fase 4C — portais oficiais prioritários homologados.
- [ ] Fase 5 — resumo semanal aprovado no grupo de teste.
- [ ] Fase 5 — grupo do IPEA configurado e envio semanal ativado.
- [ ] Fase 6 — fontes analíticas implantadas nas frequências adequadas.
- [ ] Fase 7 — decisão registrada sobre adotar ou dispensar IA.
- [ ] Métricas de 14 dias revisadas e novo plano de melhoria documentado.

---

Este arquivo é o registro de decisão do plano. Ao concluir cada fase, atualizar a data, marcar os critérios de aceite e registrar desvios de escopo ou estimativa.

## 14. Decisão de produto — base definitiva sem zona cinzenta (08/10/2026)

O usuário quer uma **decisão final binária por publicação: incluir ou descartar**, sempre com justificativa e trecho/página da fonte. “Possível achado” pode existir somente na fila **interna de investigação**, nunca como fato confirmado na base definitiva. Falha de download, texto curto ou conflito entre extratores não autorizam chute: manter em fila de recuperação até obter evidência ou registrar explicitamente a impossibilidade de verificar. Não confundir a classificação de um documento com participação jurídica de um município.

- [ ] Auditar os candidatos e rejeitados atuais, com pares de casos positivos/negativos e teste de regressão para cada nova regra. Incluir também **atuação comprovada** (reunião realizada, visita, contrato, ação), por decisão do usuário; uma agenda apenas cogitada não basta.
- [ ] Recuperar o texto dos legados e dos registros insuficientes; priorizar os que já foram enviados ou que a regra classificou como evento. Separar PDF sem menção, PDF escaneado/OCR pendente, HTML inacessível e artigo com texto recuperado. Uma ausência de palavra-chave só permite descarte se o documento inteiro for legível e auditado.
- [ ] Exigir no resultado final: `decisao` (incluir/descartar), `tipo_evento`, `etapa`, `justificativa`, `trecho`, `fonte`, `url`, `pagina_pdf` quando houver, `metodo_extracao`, `data_da_evidencia` e `limite_da_inferencia`. A fila interna conserva `motivo_pendente`, tentativas e próxima ação.
- [ ] Melhorar a vista de cada consórcio: nome/siglas, CNPJ e sua fonte, documentos relacionados em ordem temporal, tipos de evento, municípios com participação documental, ano da última evidência, lacunas e conflitos. Nunca mostrar “membro atual” apenas porque apareceu em notícia ou ata de preços.
- [ ] Integrar a base CNM raspada pelo usuário quando ele trouxer o arquivo do outro computador: preservar data e URL da coleta; validar formato/CNPJ, nomes e aliases; tratar como referência de identidade, não como prova de composição municipal atual. Até lá, usar apenas dados locais e fontes públicas oficiais.
- [ ] Verificar tecnicamente a integração MiDES antes de chamá-la de “API de CNPJ”: o MiDES é base de microdados de execução fiscal/contratações, útil para cruzamento **após** a entidade estar identificada, não cadastro oficial de consórcios nem prova de adesão. Procurar CNPJ do consórcio primeiro em atos constitutivos/portais oficiais, depois corroborar na CNM e guardar proveniência.

### Auditoria iniciada em 08/10/2026 (cópia local; nada publicado)

- Texto de 5 notícias antigas enviadas e 5 páginas históricas recuperado; 3 “adesões” reclassificadas como **autorização de ingresso**, sem afirmar entrada consumada.
- Rubelita/CIMAMS: assembleia de 26/08/2026 aceita como **atuação** com evidência, sem inferir adesão.
- Diário de Campo Mourão de 18/08/2026, p. 13: **adesão a ata de preços do CISNOP**, corrigida de adesão institucional para atuação/contratação; não prova que Campo Mourão é consorciado.
- Diários de Apucarana (4 páginas) e Araçariguama (6 páginas): descartados após leitura integral sem menção a consórcio; Maracaju (474 páginas) continua pendente de verificação com extração alternativa.
- COIN-GM: rejeição automática revertida; assembleia aprovou consolidação do protocolo e inclusão de quatro municípios, mas a ratificação do projeto municipal ainda estava em análise. Não registrar entrada efetiva só com essa notícia.
- Mamborê/CIS COMCAM (PDF p. 27), Salinas/CISRUN (p. 91), CONIRPI (p. 4) e Rio Claro/CISMETRO (p. 17): rejeições revertidas após leitura visual dos atos; cada registro distingue contrato/repasse, vigência, reajuste ou aviso de pagamento de adesão institucional. Salinas traz vigência impressa inconsistente (2023 em ato de 2026), mantida como ressalva.
- Mudanças no catálogo impedem que observações antigas restaurem uma categoria já corrigida por leitura integral. A validação ainda precisa abranger toda a amostra antes de declarar a trincheira concluída.
- Catanduva/CONSIRC (p. 31) registra extinção de **contratos de prestadores**, não do consórcio; Ouro Verde do Oeste/CISCOPAR (p. 22) traz **previsão orçamentária** de R$ 2,8 milhões para 2027, não repasse executado; Alagoinhas (p. 33) é apenas cronograma genérico, descartado.
- TCE-MG: links antigos `/Noticia/{id}` agora apontam ao detalhe canônico; o leitor respeita ISO-8859-1 e recorta o corpo da notícia, eliminando conteúdo alheio da página. Cimcentral e Ciminas foram aceitos como **controle cautelar**, sem inferir condenação ou extinção.
- CIDESAA: Instrução Normativa 016/2026 aceita como **atuação normativa**. A suspensão ali é de estabelecimentos/produtos do serviço de inspeção, não do consórcio.
- A base CNM raspada existe, mas está em outro computador do usuário. Não incorporá-la nem supor seu esquema até receber o arquivo; o painel permanece local, sem publicação.

### Recuperação do arquivo bruto e identidades (09/10/2026; local)

- As duas identidades que apareciam pendentes no painel foram rastreadas às fontes. A Resolução CMS nº 35/2026 de Valinhos nomeia o Consórcio Intermunicipal do SAMU Regional Hortolândia/Sumaré, mas comprova **aprovação de proposta**, não ingresso consumado nem CNPJ. O anexo da Portaria PAICI 0654/2026/GBSES é **multi-consórcio**: os oito municípios com valor zero pertencem a cinco blocos distintos; `evidencias-complementares.ndjson` guarda um vínculo por consórcio, município(s) e página. O painel passou de 2 para 0 identidades pendentes sem inventar vínculo único.
- Dos 123 documentos brutos que só tinham título, 87 receberam texto HTML integral e 11 receberam prova curta por página de PDF. Outros três foram fechados por conferência direta em fontes oficiais: a Lei 5651/2026 de São João da Boa Vista ratifica o estatuto do CEMMIL sem nova adesão; a Lei 1777/2026 de Congonhal ratifica alteração contratual do CISMARPA (PDF digitalizado, p. 1); e um link de Centenário do Sul repete a Lei 3309/2026 já catalogada. Restam **22** sem texto/evidência suficiente no arquivo bruto. O fluxo anota `http_403`, timeout, destino não HTML/PDF, ausência de texto e outras causas. Os arquivos integrais ficam separados do resumo curto e omitem identificadores pessoais óbvios.
- A releitura local gerou 24 **sugestões para conferência**, sem promover nenhuma a evento nem enviar ao WhatsApp. Dez textos idênticos foram agrupados por hash; concurso e acórdão antigo não geram sugestão nova. A fila humana ainda precisa decidir os casos reais, inclusive possíveis republicações da crise hospitalar do Mato Grosso.
- A rotina diária de recuperação foi ampliada para títulos antigos e PDFs, inclusive arquivos PDF servidos como tipo não HTML, com limite de lote. O painel local passou a mostrar texto integral, motivo de falha e vínculo multi-consórcio; **GitHub Pages permanece desativado**.

### Revisão em dupla de dez casos (09/10/2026; local)

- Decisões incorporadas com hash do trecho e fonte por documento: seis rejeições (mural agregador do CODAP, menção passiva do CIMCERO, resultado de busca de Sabáudia, recrutamento do Consórcio 08 de Abril, requerimento de São Lourenço da Mata e pedido de informações de Pato Branco), três eventos aceitos (cautelar do TCE-MS/CIDEMA, Lei 1117/2026 de Campina Grande do Sul/CISPAR e recomendação reportada do MPMT/CISVP) e uma duplicata da recomendação do CISVP. A suspensão do CIDEMA foi conferida no Diário Oficial do TCE-MS 4498, pp. 23–26; a lei de Campina Grande do Sul foi conferida na norma 2994 do SAPL. A recomendação do CISVP permanece baseada nas reportagens, sem documento primário localizado; data de início do prazo e medidas posteriores não foram inferidas.
- Escopo confirmado pelo usuário: mural de licitações serve para **descobrir atos individuais**, não vira evento único; participação passiva em evento de terceiros, sem entrega ou compromisso, fica fora da base. Recrutamento também fica fora. O registro de uma lei de autorização não declara adesão consumada.
- Regras de regressão: requerimento (mesmo aprovado) não executa a adesão solicitada; pauta de PL sem resultado não comprova aprovação; página de busca não é lei individual; dissolução apresentada como alternativa pelo MP não é extinção. O caso Campina Grande do Sul só entra porque a lei posterior foi vinculada e conferida. A releitura dos 87 textos guardados aplica as regras aos antigos e às novas coletas.
- Após essa rodada, o painel local registra **17 documentos brutos ainda sem texto/evidência** e **19 sugestões ainda para revisão**, contra 22 e 24 antes da amostra. Nenhum item foi automaticamente enviado ao WhatsApp ou publicado no GitHub Pages.
- Auditoria adicional das sugestões restantes identificou seis republicações quase literais da mesma Recomendação 23/2026 ao CISVP (95% a 97% de contenção textual no núcleo da notícia) e outra reportagem sobre a cautelar já conferida do CIDEMA. Todas foram vinculadas aos respectivos registros principais como duplicatas editoriais, com fonte e hash próprios. A fila de sugestões **caiu de 19 para 12**, sem descartar automaticamente qualquer desenvolvimento posterior genuíno.

### Revisão dos 29 pendentes (09/10/2026; local)

- O lote era composto de **17 publicações sem texto suficiente** e **12 sugestões com texto recuperado**. Foram decididos 27 registros: **8 aceites, 18 descartes e 1 duplicata**. Nenhuma das 12 sugestões permanece sem decisão; dos 17 brutos, restam apenas 2 sem prova acessível.
- Aceites de naturezas distintas: reprovação de contas do CISVAP pelo TCE-PB (**controle**); chamamento efetivamente aberto pelo CIMU, interrupção do CISOP após furto, equipamento recebido pelo CIMSA e dispensa concluída de Rio Espera/CISAP-VP (**atuação**); reeleição do CISMIV, lei de Juína que ratifica alteração do CIDESA e aprovação legislativa em Divinópolis para **autorizar** dissolução (**governança**). A lei de Divinópolis não prova dissolução consumada, e a dispensa de Rio Espera não prova contrato assinado nem entrega do veículo.
- Descartes incluem proposta ainda em tramitação na ALMG, leis/PLs antigos reindexados, páginas agregadoras ou institucionais, menções genéricas e um caso de consórcio **interestadual** (Brasil Central) fora do recorte intermunicipal adotado neste radar. A notícia de Umuarama foi ligada como duplicata, preservando a evidência original.
- Duas páginas oficiais permanecem **pendentes de acesso**, não classificadas por palpite: notícia do Selo SIM na Câmara de Guanhães (proteção Cloudflare) e tramitação do PL 11/2026 de Passo de Torres (verificação de navegador). Para fechá-las, será preciso obter o texto/PDF por via oficial ou cópia fornecida pelo usuário; não contornar CAPTCHA.
- A memória editorial agora é aplicada também às próximas coletas e aos itens antigos da fila. Rejeições e duplicatas com evidência assinada não retornam como achados por reclassificação. Regras de leitura foram reforçadas para separar interrupção de serviço de **saída de município**, proposta legislativa de ato consumado e entrega/abertura efetiva de simples intenção.
- Estado local após recompor o painel: **1.500 publicações arquivadas, 71 aceitas, 51 descartadas, 16 duplicatas, 41 consórcios candidatos e 56 vínculos documentais**. Ainda há 2 brutos sem texto suficiente. Os 64 envios históricos ao WhatsApp não foram alterados; não houve nova coleta, envio ou publicação desta revisão. `npm test`: 191/191; `npm run check`: aprovado. GitHub Pages continua desativado.

### Fechamento das duas fontes difíceis (09/10/2026; local)

- **Guanhães:** a página oficial ainda devolve HTTP 403 ao coletor. O usuário forneceu o texto integral; a data visível é **02/12/2021**, embora o Google a tenha reindexado como se fosse de 2026. A assembleia do CONBAS e a assinatura de protocolo de intenção por quatro municípios foram preservadas na revisão como **evidência histórica**, sem inferir adesão efetiva nem implantação do SIM. A publicação foi descartada do radar de novidades de 2026. Trata-se de exceção manual identificada como tal, não de uma solução automática para o bloqueio do portal.
- **Passo de Torres:** a URL oficial direta da Câmara voltou a responder normalmente; Readability e Trafilatura extraíram o corpo do PL 11/2026 e concordaram em **GOVERNANÇA**. Uma URL estável foi cadastrada para as próximas tentativas de recuperação. A [Lei Ordinária 1.419/2026](https://static.dom.sc.gov.br/?id=8511407&r=site/atoView), publicada no DOM-SC em 14/07/2026, confirma a ratificação posterior das alterações do contrato do CISAMREC. O evento foi aceito como ratificação contratual, **não** como nova adesão. O painel mostra a data original da ficha do PL (01/06/2026), em vez da data de indexação do Google.
- Resultado do lote inteiro: **1.500 documentos, 72 aceites, 52 descartes, 16 duplicatas, 42 consórcios candidatos, 57 vínculos documentais, 0 sugestões e 0 brutos sem decisão**. Os 64 envios históricos ao WhatsApp não foram alterados; nenhuma mensagem nova foi enviada. `npm test`: 193/193.
- Regra operacional: sites podem responder 403 ou apresentar um desafio mesmo com HTTP 200. O robô deve tentar a URL canônica oficial e fontes oficiais alternativas, manter a falha visível e retornar depois; não contornar CAPTCHA, não completar texto com título/resultado de busca e não tratar cópia fornecida pelo usuário como coleta automática bem-sucedida. A publicação de Guanhães demonstra que **cobertura automática de 100% não é garantível** sem cooperação ou API do portal.
