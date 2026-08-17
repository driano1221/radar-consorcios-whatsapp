# Radar de Consórcios no WhatsApp

Radar automatizado de notícias e atos oficiais sobre consórcios intermunicipais. O projeto consulta fontes públicas uma vez por hora, identifica acontecimentos relevantes, evita repetições e publica resumos curtos em um grupo do WhatsApp.

O piloto apoia a pesquisa do Ipea **“Avanços e Limites da Coordenação Federativa por meio de Consórcios Intermunicipais: aprendendo com os ‘fracassos’”**.

## Estado atual

- piloto ativo desde 14 de agosto de 2026;
- repositório privado e execução gratuita pelo GitHub Actions;
- destino atual: grupo **Radar Consórcios - Teste**;
- 24 coletas por dia, no minuto 17 de cada hora, no fuso de São Paulo;
- até 3 publicações por rodada e 72 por dia, somente quando houver conteúdo novo;
- orçamento do GitHub Actions em **US$ 0**, com bloqueio de uso pago;
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

O radar combina quatro famílias de fontes:

- Google News RSS, com 17 consultas temáticas, incluindo controle, Ministério Público e Legislativo;
- API pública do Querido Diário, dividida em três grupos de termos;
- feeds diretos do COPIRN, Observatório das Metrópoles, Frente Nacional de Prefeitas e Prefeitos e Agência Brasil.
- scrapers leves da RNCP, da área de Consórcios da CNM e das notícias do TCE-MG; o índice da AMM-MG também é monitorado.

Cada família é consultada de forma independente. A falha temporária de uma fonte não interrompe as demais.

Os scrapers estão inicialmente com `publish: false`: coletam, classificam e aparecem no resumo do GitHub Actions, mas não enviam mensagens ao WhatsApp. As observações ficam em `output/scraper-observations.json`, os candidatos relevantes em `output/scraper-candidates.json`, a saúde dos portais em `output/scraper-health.json` e a mensagem formatada em `output/scraper-preview.txt`. Isso permite homologar relevância e estabilidade antes da ativação.

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

Somente as três mais relevantes são enviadas na rodada atual. As demais **não são marcadas como enviadas** e voltam a concorrer nas coletas seguintes enquanto permanecerem disponíveis nas fontes e dentro da janela de 96 horas.

O piloto ainda não possui uma fila persistente. Depois da homologação, a principal evolução prevista é guardar todos os candidatos relevantes com prioridade, data de descoberta, tentativas e prazo de expiração.

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

O GitHub Free inclui 2.000 minutos mensais de Actions em repositórios privados. O job possui limite rígido de dois minutos:

```text
24 execuções × 31 dias × 2 minutos = 1.488 minutos/mês
```

O orçamento da conta está configurado em zero e bloqueia cobrança adicional após a franquia.

## Segurança e limitações

- A conexão usa WhatsApp Web por meio do Baileys; não é uma API oficial da Meta.
- A sessão vinculada entra no repositório somente após criptografia.
- Dados criptográficos internos são filtrados dos logs.
- `.local/`, sessões abertas, senha, número pessoal e ID do grupo não entram no Git.
- O destino é definido por um secret do GitHub.
- O Actions é periódico e pode sofrer pequenos atrasos.
- Se o WhatsApp desvincular o aparelho, será necessário parear novamente.

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
