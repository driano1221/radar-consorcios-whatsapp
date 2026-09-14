# Radar de Consórcios no WhatsApp

Radar automatizado de notícias e atos oficiais sobre consórcios intermunicipais. O projeto consulta fontes públicas uma vez por hora, identifica acontecimentos relevantes, evita repetições e publica resumos curtos em um grupo do WhatsApp.

O piloto apoia a pesquisa do Ipea **“Avanços e Limites da Coordenação Federativa por meio de Consórcios Intermunicipais: aprendendo com os ‘fracassos’”**.

## Estado atual

- piloto ativo desde 14 de agosto de 2026;
- repositório público e runners padrão do GitHub Actions;
- destino atual: grupo **Radar Consórcios - Teste**;
- 24 coletas por dia, no minuto 17 de cada hora, no fuso de São Paulo;
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
- feeds diretos do COPIRN, CIGA, CISREC, CONIAPE, Observatório das Metrópoles, Frente Nacional de Prefeitas e Prefeitos e Agência Brasil;
- portais TCE-MG, TCE-SP e índice da AMM-MG; adaptadores RNCP/CISAMAPI disponíveis, mas desativados no Actions por HTTP 403;
- APIs SAPL de normas jurídicas de Unaí e São João da Boa Vista.

A CNM direta continua desativada por bloqueio HTTP; sua descoberta pelo Google permanece. RNCP e CISAMAPI funcionaram localmente, mas falharam no GitHub. TCE-PR direto ainda não foi homologado.

Cada família é consultada de forma independente. A falha temporária de uma fonte não interrompe as demais.

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

## Frequência e cota gratuita

O repositório é público: os minutos de runners padrão são gratuitos segundo a [documentação do GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions). O coletor tem timeout de oito minutos, a saúde da sessão de três e o resumo semanal de cinco; esses limites não são a duração esperada. Artefatos de coleta expiram em sete dias e os resumos em 14 dias para limitar armazenamento. Nenhum serviço pago foi acrescentado.

## Segurança e limitações

- A conexão usa WhatsApp Web por meio do Baileys; não é uma API oficial da Meta.
- A sessão vinculada entra no repositório somente após criptografia.
- Dados criptográficos internos são filtrados dos logs.
- `.local/`, sessões abertas, senha, número pessoal e ID do grupo não entram no Git.
- O destino é definido por um secret do GitHub.
- O Actions é periódico e pode sofrer pequenos atrasos.
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
- `WHATSAPP_GROUP_ID`: ID do grupo de destino.

### Variable

- `SEND_ENABLED`: `true` para publicar ou `false` para pausar.

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

O radar coleta a cada hora (minuto 17), busca publicações dos últimos **sete dias** e mantém até três envios por rodada. Fontes diretas adicionadas: TCE-SP, RSS de CONIAPE/CIGA/CISREC e APIs SAPL de Unaí e São João da Boa Vista. RNCP e CISAMAPI têm adaptadores testados localmente, mas dependem de cobertura via Google no Actions. O Querido Diário usa o endereço atual, mas ainda apresenta oscilações externas.

**Resumo semanal:** sábado às **9h de Brasília**, com nova tentativa às 12h somente se ainda não tiver sido confirmado. Destino: `WHATSAPP_WEEKLY_GROUP_ID` ou, na ausência, o grupo já configurado. A operação atual continua no grupo de teste. O resumo conta achados descobertos no período, não apenas mensagens enviadas. Histórico inicial parcial é informado na mensagem.

**Alertas:** workflows abrem uma ocorrência no GitHub em caso de falha; fontes geram alerta após três falhas consecutivas. Ocorrências são reaproveitadas e encerradas após recuperação. As notificações seguem suas preferências do GitHub.

Comandos adicionais: `npm run weekly` gera a prévia; `node scripts/validate-sources.mjs` testa fontes ao vivo; `node scripts/preview-messages.mjs output/research-final-state.json` cria uma simulação visual a partir do estado de pesquisa. Use `SEND_ENABLED=false` para prévias. `PERSIST_STATE=true` registra observações sem enviar, e `NEWS_STATE_FILE` permite isolar o estado de teste.

Detalhes, fontes, exemplos antes/depois e limitações: [pesquisa e validação](docs/PESQUISA_E_VALIDACAO_2026-09-14.md).
