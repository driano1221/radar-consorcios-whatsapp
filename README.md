# Radar de Consórcios no WhatsApp

Radar automatizado de notícias e atos oficiais sobre consórcios intermunicipais. O projeto tenta consultar fontes públicas aproximadamente uma vez por hora, identifica acontecimentos relevantes, evita repetições e publica resumos curtos em um grupo do WhatsApp.

O piloto apoia a pesquisa do Ipea **“Avanços e Limites da Coordenação Federativa por meio de Consórcios Intermunicipais: aprendendo com os ‘fracassos’”**.

## Estado atual

- piloto ativo desde 14 de agosto de 2026;
- repositório público e runners padrão do GitHub Actions;
- destino atual: grupo **Radar Consórcios - Teste**;
- agendamento redundante nos minutos 11, 26, 41 e 56; coletas com menos de 50 minutos de intervalo são dispensadas;
- até 3 publicações por rodada e 72 por dia, somente quando houver conteúdo novo;
- sem API paga, n8n ou servidor permanente;
- sessão do WhatsApp cifrada com AES-256-GCM;
- primeira coleta sem envio e primeira rodada real concluídas com sucesso.

Para interromper os disparos imediatamente, altere a variável `SEND_ENABLED` para `false` em **Settings → Secrets and variables → Actions → Variables**.

## O que o radar procura

São priorizados acontecimentos ligados à composição, sustentabilidade e governança dos consórcios públicos:

- criação ou dissolução;
- adesão e saída de municípios;
- protocolo de intenções e contrato de consórcio;
- contrato de rateio e situação financeira;
- inadimplência, paralisação e crise institucional;
- fiscalização, irregularidades e controle;
- alteração de governança ou área de atuação.

Consórcios empresariais e comerciais, compras comuns e adesões a atas de preços recebem penalidades para reduzir falsos positivos.

## Fontes

O radar combina cinco famílias de fontes:

- Google News RSS, com 21 consultas temáticas, incluindo controle, Ministério Público, Legislativo e filtros para RNCP, CNM, CISAMAPI e TCE-PR;
- API pública do Querido Diário, dividida em três grupos de termos;
- feeds diretos do COPIRN, CISREC, CONIAPE, Observatório das Metrópoles, Frente Nacional de Prefeitas e Prefeitos e Agência Brasil;
- API de artigos do Consórcio de Inovação na Gestão Pública (CIGA), usando a data editorial da notícia;
- portais TCE-MG, TCE-SP e índice da AMM-MG; adaptadores RNCP/CISAMAPI disponíveis, mas desativados no Actions por HTTP 403;
- APIs SAPL de normas jurídicas de Unaí e São João da Boa Vista.

A CNM direta continua desativada por bloqueio HTTP; sua descoberta pelo Google permanece. RNCP e CISAMAPI funcionaram localmente, mas falharam no GitHub. O antigo endereço de RSS do CIGA passou a devolver HTML, por isso foi substituído pela API de artigos do próprio consórcio. TCE-PR direto ainda não foi homologado.

Cada família é consultada de forma independente. A falha temporária de uma fonte não interrompe as demais.

O Querido Diário tem períodos de HTTP 503 no serviço de origem. Essas falhas ficam visíveis na saúde das fontes; as consultas seguintes repetem a janela de sete dias para recuperar publicações quando a API voltar. A disponibilidade desse serviço externo não pode ser garantida pelo radar.

Cada scraper possui ativação própria. TCE-MG e TCE-SP podem publicar quando os critérios forem atendidos. AMM-MG monitora somente o índice, em prévia. Falhas na leitura do artigo mantêm o item em prévia. Relatórios e prévias ficam em `output/` e nos artefatos das execuções.

## Funcionamento de cada rodada

1. consulta as fontes em paralelo, com timeout e nova tentativa;
2. normaliza e reúne as publicações;
3. classifica os eventos e calcula a relevância;
4. elimina duplicidades;
5. ordena por pontuação e, em caso de empate, pela publicação mais recente;
6. seleciona até três candidatos, respeitando o limite diário;
7. envia as mensagens com intervalo de seis segundos;
8. registra cada entrega imediatamente;
9. renova a sessão cifrada e persiste o histórico no repositório.

## Quando existem mais de três notícias

Somente as três mais relevantes são enviadas na rodada atual. As demais ficam em uma fila persistente por até 30 dias, com data de descoberta, tentativas e último erro. Um candidato só sai da fila depois da confirmação de entrega, evitando perdas quando o WhatsApp estiver indisponível ou a notícia sair da janela de coleta.

## Proteção contra duplicatas

A deduplicação combina:

- URL canônica, removendo parâmetros de rastreamento;
- título normalizado;
- impressão digital do título;
- similaridade do conteúdo dentro da mesma categoria;
- comparação entre fontes na mesma rodada;
- histórico persistente das notícias enviadas por 365 dias.

Isso permite reconhecer, por exemplo, o mesmo ato publicado por duas fontes com títulos e endereços diferentes. Nenhum método é infalível; casos reais observados durante o piloto serão usados para calibrar os limiares.

## Apresentação de títulos e links

Quando o Google Notícias entrega uma manchete terminada em reticências, o radar procura a ementa completa no portal legislativo de origem. Se encontra a norma e confirma o endereço direto, usa um título curto baseado na ementa. Caso contrário, apresenta um título editorial conservador, sem reproduzir a frase cortada.

Links de até 100 caracteres são mantidos diretos, privilegiando o endereço da fonte. Para links maiores, o radar usa a API gratuita do [Spoo.me](https://spoo.me/docs/api-reference/url-shortening/create-shortened-url) e confirma que o endereço curto redireciona para a fonte correta antes de publicá-lo. A resposta validada fica em cache; entradas antigas do CleanURI e is.gd são ignoradas. Se o serviço falhar, a mensagem usa o endereço original. O endereço original continua guardado para deduplicação e conferência.

## Frequência e cota gratuita

O repositório é público: os minutos de runners padrão são gratuitos segundo a [documentação do GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions). O coletor tem timeout de oito minutos, a saúde da sessão de três e o resumo semanal de cinco; esses limites não são a duração esperada. Artefatos de coleta expiram em sete dias e os resumos em 14 dias para limitar armazenamento. Nenhum serviço pago foi acrescentado.

## Segurança e limitações

- A conexão usa WhatsApp Web por meio do Baileys; não é uma API oficial da Meta.
- A sessão vinculada entra no repositório somente após criptografia.
- Dados criptográficos internos são filtrados dos logs.
- `.local/`, sessões abertas, senha, número pessoal e ID do grupo não entram no Git.
- O destino é definido por um secret do GitHub.
- O agendador do Actions pode atrasar ou descartar execuções. Os quatro horários aumentam as oportunidades de disparo; o estado impede coletas repetidas em menos de 50 minutos, sem garantir uma execução exata a cada hora.
- Se o WhatsApp desvincular o aparelho, será necessário parear novamente.
- Mesmo sem notícias novas, a sessão é verificada a cada 24 horas para que uma desconexão não fique escondida atrás de execuções verdes.

## Instalação local

Requisitos: Node.js 20 ou superior e Git.

```powershell
npm install
npm test
```

### Parear o WhatsApp

```powershell
npm run pair
```

Abra **WhatsApp → Dispositivos conectados → Conectar dispositivo** e leia o QR. O script salva a relação de grupos apenas em `.local/groups.json`.

### Verificar a sessão sem enviar

```powershell
$env:WHATSAPP_GROUP_ID='ID_DO_GRUPO@g.us'
npm run session:check
```

### Coletar sem publicar

```powershell
npm run collect
```

Os candidatos ficam em `output/candidates.json`; a prévia formatada fica em `output/preview.txt`.
As saídas de homologação dos scrapers ficam nos arquivos `output/scraper-*`.

### Publicação local controlada

```powershell
$env:SEND_ENABLED='true'
$env:WHATSAPP_GROUP_ID='ID_DO_GRUPO_DE_TESTE@g.us'
$env:MAX_POSTS_PER_RUN='1'
npm run collect
```

## Configuração do GitHub

Em **Settings → Secrets and variables → Actions**:

### Secrets

- `BOT_STATE_PASSWORD`: senha que cifra a sessão;
- `WHATSAPP_GROUP_ID`: ID do grupo de destino;
- `DEEPSEEK_API_KEY`: chave da segunda revisão editorial por IA.

### Variable

- `SEND_ENABLED`: `true` para publicar ou `false` para pausar.
- `AI_REVIEW_ENABLED`: `true` para exigir revisão por IA antes de publicar; `false` para desligá-la sem mudar o código.

Com IA ativa, o radar faz no máximo 12 revisões por rodada e 60 por dia. O boletim semanal também revisa achados ainda não avaliados, com teto de 40 chamadas por edição. Decisões são guardadas no estado para não pagar novamente pela mesma notícia. Erro de API, JSON inválido ou evidência ausente suspendem o envio daquele item; discordância sobre rateio fica na fila e no relatório de auditoria. Na edição semanal, rateio documentado por cláusulas de um contrato pode permanecer com divergência registrada. O teste isolado da integração está no workflow **Avaliação pontual de IA**.

## Homologação até domingo

Até a revisão de 16 de agosto de 2026, observar:

- relevância e falsos positivos;
- eventuais repetições;
- qualidade e tamanho das mensagens;
- volume por dia;
- tempo entre o fato e a publicação;
- estabilidade da sessão do WhatsApp;
- recuperação das notícias que ficaram fora das três primeiras.

As decisões, resultados iniciais e próximos passos estão registrados em [docs/MEMORIA_DO_PROJETO.md](docs/MEMORIA_DO_PROJETO.md). A pesquisa técnica está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Recuperação

Se o WhatsApp desvincular a sessão, execute `npm run pair` e depois `npm run session:prepare`. Atualize os arquivos cifrados `state/auth.*` no repositório. O histórico de notícias enviadas permanece preservado em `state/news-state.json`.

## Atualização operacional — 14/09/2026

O agendador roda a cada **2 horas** (minuto 17). Até 23/09/2026 ele pedia execuções de 15 em 15 minutos, mas o GitHub pulava a maioria delas (na prática eram 4 a 6 coletas por dia) e agendamento muito frequente é tratado como padrão de abuso; a conta chegou a ser sinalizada. Uma coleta recente ainda faz a execução ser dispensada. O radar busca publicações dos últimos **sete dias** e mantém até três envios por rodada. Fontes diretas adicionadas: TCE-SP, RSS de CONIAPE/CIGA/CISREC e APIs SAPL de Unaí e São João da Boa Vista. RNCP e CISAMAPI têm adaptadores testados localmente, mas dependem de cobertura via Google no Actions. O Querido Diário usa o endereço atual, mas ainda apresenta oscilações externas.

**Resumo semanal:** sábado às **9h de Brasília**, com nova tentativa às 12h somente se ainda não tiver sido confirmado. Destino: `WHATSAPP_WEEKLY_GROUP_ID` ou, na ausência, o grupo já configurado. A operação atual continua no grupo de teste. O boletim usa uma linha do tempo, da publicação mais recente à mais antiga, com categoria, fonte, data e link curto quando necessário; lista todos os achados relevantes e não mostra volume bruto de coleta nem falhas técnicas. Menções contábeis e contratuais de rotina são retiradas da lista. No despacho manual, `test_preview=true` usa a janela até agora; `edition` permite enviar uma versão revisada sem repetir acidentalmente a mesma edição.

**Alertas:** workflows abrem uma ocorrência no GitHub em caso de falha; fontes geram alerta após três falhas consecutivas. Ocorrências são reaproveitadas e encerradas após recuperação. As notificações seguem suas preferências do GitHub.

Comandos adicionais: `npm run weekly` gera a prévia; `node scripts/validate-sources.mjs` testa fontes ao vivo; `node scripts/preview-messages.mjs` cria uma simulação visual em `output/message-preview.html` a partir do estado atual. Use `SEND_ENABLED=false` para prévias. `PERSIST_STATE=true` registra observações sem enviar, e `NEWS_STATE_FILE` permite isolar o estado de teste.

As mensagens usam a sintaxe nativa do WhatsApp (`*negrito*`, `_itálico_`, `> citação` e lista numerada), com URL simples em vez de link Markdown. Resumos extensos são divididos em partes de até 3.400 caracteres, preservando todos os achados. O estudo e os limites da IA estão em [docs/avaliacao-ia-2026-09-22.md](docs/avaliacao-ia-2026-09-22.md).

Detalhes, fontes, exemplos antes/depois e limitações: [pesquisa e validação](docs/PESQUISA_E_VALIDACAO_2026-09-14.md).
