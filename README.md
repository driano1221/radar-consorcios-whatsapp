# Radar de Consórcios no WhatsApp

Piloto sem servidor e sem n8n para monitorar notícias e atos oficiais sobre consórcios intermunicipais. O GitHub Actions consulta as fontes uma vez por hora, classifica eventos, elimina duplicações e publica mensagens curtas em um grupo existente do WhatsApp.

O projeto foi criado para apoiar a pesquisa do Ipea **“Avanços e Limites da Coordenação Federativa por meio de Consórcios Intermunicipais: aprendendo com os ‘fracassos’”**.

## Cobertura

O radar combina três famílias de fontes:

- Google News RSS, com 12 consultas temáticas;
- API pública do Querido Diário, dividida em três grupos de termos;
- feeds diretos do COPIRN, Observatório das Metrópoles, Frente Nacional de Prefeitas e Prefeitos e Agência Brasil.

São priorizados criação, adesão, saída, dissolução, protocolo de intenções, contrato de rateio, finanças, governança, fiscalização, irregularidades e paralisação. Consórcios empresariais, comerciais e adesões a atas de preços recebem penalidades para evitar falsos positivos.

## Frequência e cota

O workflow roda no minuto 17 de cada hora, no fuso de São Paulo: **24 execuções por dia**. Cada execução pode publicar até três notícias, com teto teórico de 72 mensagens diárias se houver conteúdo relevante.

Em repositório privado GitHub Free há 2.000 minutos mensais. Como os jobs são arredondados para o próximo minuto, o workflow usa limite rígido de dois minutos:

```text
24 execuções × 31 dias × 2 minutos = 1.488 minutos/mês
```

Isso reserva ao menos 512 minutos para testes manuais e variações. Configure o orçamento de cobrança em zero para impedir gastos após a franquia.

## Segurança e limitações

- A conexão usa WhatsApp Web por meio do Baileys; não é uma API oficial da Meta.
- A sessão vinculada é armazenada no repositório somente após criptografia AES-256-GCM.
- Dados criptográficos internos da biblioteca são filtrados dos logs.
- `.local/`, sessões abertas e senhas nunca entram no Git.
- O destino é definido por secret; durante a homologação, use apenas **Radar Consórcios - Teste**.
- GitHub Actions é periódico e pode sofrer pequenos atrasos.

## Instalação local

Requisitos: Node.js 20 ou superior e Git.

```powershell
npm install
npm test
```

## Parear o WhatsApp

```powershell
npm run pair
```

Abra **WhatsApp → Dispositivos conectados → Conectar dispositivo** e leia o QR. O script salva os grupos em `.local/groups.json`.

Para verificar sessão e grupo sem enviar:

```powershell
$env:WHATSAPP_GROUP_ID='ID_DO_GRUPO@g.us'
npm run session:check
```

## Coleta sem publicação

O envio é desabilitado por padrão:

```powershell
npm run collect
```

Os candidatos ficam em `output/candidates.json`; a prévia pronta para WhatsApp fica em `output/preview.txt`.

## Publicação local controlada

```powershell
$env:SEND_ENABLED='true'
$env:WHATSAPP_GROUP_ID='ID_DO_GRUPO_DE_TESTE@g.us'
$env:MAX_POSTS_PER_RUN='1'
npm run collect
```

Cada entrega é persistida imediatamente em `state/news-state.json`, reduzindo o risco de repetição caso uma mensagem posterior falhe.

## Sessão criptografada

```powershell
npm run session:prepare
```

O comando cria ou reutiliza a senha em `.local/bot-state-password.txt` e atualiza:

- `state/auth.enc`: sessão criptografada;
- `state/auth.sha256`: hash de controle.

No GitHub, configure em **Settings → Secrets and variables → Actions**:

### Secrets

- `BOT_STATE_PASSWORD`: conteúdo de `.local/bot-state-password.txt`;
- `WHATSAPP_GROUP_ID`: ID do grupo **Radar Consórcios - Teste** durante a homologação.

### Variable

- `SEND_ENABLED`: `true` para a homologação automática; mude para `false` para interromper imediatamente.

## Funcionamento por rodada

1. instala dependências usando o lockfile;
2. restaura a sessão criptografada;
3. consulta fontes em paralelo, com timeout e nova tentativa;
4. classifica e pontua os eventos;
5. elimina URL, título e conteúdo equivalentes;
6. respeita os tetos por rodada e por dia;
7. envia no máximo três mensagens, com intervalo;
8. grava cada entrega e renova a sessão criptografada;
9. persiste somente estado e sessão cifrada.

## Homologação

Mantenha o ID do grupo de teste até a revisão de domingo. Observe volume, falsos positivos, repetições, qualidade dos resumos e estabilidade da sessão. Só depois substitua `WHATSAPP_GROUP_ID` pelo grupo definitivo.

Detalhes da pesquisa técnica e das escolhas estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Recuperação

Se o WhatsApp desvincular a sessão, execute `npm run pair`, depois `npm run session:prepare`, e atualize os dois arquivos `state/auth.*` no repositório. O histórico de notícias enviadas permanece preservado.
