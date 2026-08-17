# Arquitetura e pesquisa técnica

## Objetivo editorial

O radar privilegia mudanças na composição e na sustentabilidade institucional dos consórcios: formação, ingresso, retirada, dissolução, inadimplência, rateio, alteração de protocolos, governança e controle. Esse recorte segue o objetivo do projeto do Ipea de compreender fatores que facilitam ou dificultam adesão e permanência de governos locais.

## Projetos estudados

- [Baileys](https://github.com/WhiskeySockets/Baileys): conexão leve por WebSocket, persistência das chaves de sessão e tratamento de reconexão. Foi mantida a versão estável 6.7.24; a linha 7 ainda está em release candidate.
- [WPPConnect](https://github.com/wppconnect-team/wppconnect): referência para múltiplas sessões e tolerância a mudanças do WhatsApp Web. Não foi adotado porque exige Chromium/Puppeteer e tende a consumir mais tempo no Actions.
- [Miniflux](https://github.com/miniflux/v2): inspirou timeout por fonte, filtros positivos/negativos, remoção de rastreadores, sanitização e atualização periódica.
- [Huginn](https://github.com/huginn/huginn): inspirou a separação coleta → evento → ação e o isolamento de falhas entre fontes.
- [changedetection.io](https://github.com/dgtlmoon/changedetection.io): reforçou a importância de reduzir ruído e deduplicar alterações equivalentes antes da notificação.

## Fontes

- [Querido Diário](https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html): atos municipais estruturados; a documentação indica referência de 60 requisições por minuto. O radar faz três por hora.
- Google News RSS: descoberta ampla de imprensa e portais locais.
- COPIRN, Observatório das Metrópoles, FNP e Agência Brasil: feeds diretos, sem depender exclusivamente do índice do Google.
- TCE-MG: scraping leve de HTML público, com adaptador isolado e publicação inicialmente desativada.
- RNCP e CNM: os parsers funcionam localmente, mas os portais responderam `403` no GitHub Actions. As chamadas diretas ficam desativadas e são substituídas por consultas `site:` no Google News, sem contornar a proteção dos portais.
- Diário Municipal AMM-MG: protótipo que monitora a edição mais recente, sem tentar contornar CAPTCHA e sem publicar o PDF como notícia.
- PNCP e Transferegov foram avaliados, mas não entram no disparo inicial: possuem grande volume de compras e transferências com risco de desviar o foco de adesão/permanência. Podem alimentar uma camada analítica futura.

## Cálculo da cota

O GitHub Free inclui 2.000 minutos mensais para Actions em repositórios privados. Jobs são arredondados para o próximo minuto. Uma execução a cada hora, limitada a dois minutos, tem pior caso de 1.488 minutos em mês de 31 dias. Rodar a cada 30 minutos poderia atingir 2.976 minutos e, por isso, foi descartado.

## Robustez aplicada

- quatro famílias de fontes em paralelo;
- falha parcial não derruba as fontes saudáveis;
- timeout e uma nova tentativa por requisição;
- `User-Agent` identificável, uma consulta por portal a cada hora e nenhum contorno de bloqueios;
- detecção de mudança estrutural nos portais e fixtures de teste para cada parser;
- quarentena (`publish: false`) para novos scrapers até homologação;
- exclusões explícitas para consórcio empresarial/comercial e ata de preços;
- análise do trecho focal do ato, evitando cláusulas-padrão de anexos;
- deduplicação por URL canônica, título e similaridade de conteúdo;
- gravação atômica do estado;
- persistência após cada mensagem entregue;
- limite por rodada e por dia;
- reconexão apenas para erros transitórios;
- sessão AES-256-GCM e filtragem de chaves nos logs;
- lockfile e testes automatizados.
