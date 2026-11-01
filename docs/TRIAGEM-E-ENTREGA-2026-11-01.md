# Triagem e entrega — conferência de 01/11/2026

## Por que os casos ficaram parados

Havia quatro problemas distintos. A busca por palavras-chave confundia cláusulas de anexos com o ato efetivamente publicado; decisões mais recentes nem sempre substituíam a categoria/etapa antiga na projeção do catálogo; a recuperação executava antes da incorporação dos registros novos ao arquivo; e a fila de mensagens também continha itens ainda sem decisão. Assim, uma atualização de regra podia transformar uma pista antiga da fila em mensagem, sem representar uma notícia nova.

O [lote de 51](../data/catalogo/conclusao-pendencias-51.json) recebeu 19 confirmações, 27 rejeições e cinco pendências reais de acesso. As 484 revisões humanas e os lotes anteriores foram preservados. Os 51 têm bloqueios de alerta e resumo retroativos. Uma aquisição administrativa de veículo foi rejeitada por prova alternativa preservada, sem fingir que o endereço original bloqueado abriu.

Exemplos da regra geral: lei que ratifica alteração de contrato é Atuação/Governança, não ingresso ou saída descritos em anexo; dotação municipal não é contrato de rateio assinado; autorização de aditivo confirma somente a autorização, na etapa Rateio em tramitação. Os dois PDFs extensos foram lidos com OCR seletivo: projeto geral de licitações e requerimento sujeito a despacho não demonstravam os eventos inicialmente sugeridos.

## Correções verificáveis

1. `operative-act.mjs` identifica o dispositivo/ocorrência e guarda prova literal; negação, hipótese e etapa futura têm regressões próprias.
2. `catalog.mjs` materializa categoria, etapa, prova e bloqueio da decisão canônica; releitura fraca não apaga revisão humana.
3. A coleta aplica `applySimpleTriage` antes de enfileirar. `wasQueuedAsConfirmed` impede promover uma pista antiga já armazenada na fila por mera atualização de regra. O catálogo continua independente da fila.
4. O catálogo incorpora as observações antes de selecionar as leituras pendentes e é atualizado novamente após a recuperação.
5. `editorial-guard.mjs` também reconhece a URL resolvida exata, preservando bloqueios de notícia histórica descoberta por um alias.
6. Mensagens dirigidas usam IDs explícitos já aprovados, verificação de recibos/aliases e confirmação individual persistida. Sem coleta ou IA nessa modalidade.

Testes relevantes: `operative-act.test.mjs`, `approved-pending-delivery.test.mjs`, `pending-51-integrity.test.mjs`, `actions-weekly-safety.test.mjs`. A conferência de formatação/URL/cláusula genérica mantém o mesmo ato e prova válida; a simulação de recaptura mantém categoria/etapa sem liberar envio antigo. Fixtures isoladas verificam comportamento; comparações com o acervo verificam preservação. Uma verificação não substitui a outra.

## Mensagens e incidente de concorrência

O [envio dirigido 41320630121](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41320630121) registrou as duas mensagens solicitadas em 01/11 às 12h20 de Brasília, sem duplicá-las.

Antes de os bloqueios retroativos finais do lote serem publicados, a [coleta agendada 41324038350](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41324038350) enviou às 13h01 três itens antigos do lote: leis 474/2026, 475/2026 e 1.580/2026. Isso extrapolou o pedido de duas mensagens. Os recibos foram preservados. Essa rodada existente também registrou quatro chamadas de IA; a manutenção e o envio dirigido registraram zero. Não se deve descrever a operação inteira como zero chamadas ou atribuir preço não conferido.

Publicar a regra antes do bloqueio do lote deixou uma janela de concorrência. A correção posterior publica juntos as conclusões, bloqueios e a guarda da fila. Ela não desfaz mensagens já recebidas nem garante exatamente uma entrega em falhas entre a rede e a persistência.

## Resumo e tabela

O [resumo de 31/10, execução 41219404693](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41219404693), falhou nos testes antes de restaurar a sessão ou preparar/enviar a mensagem. O teste da Lei 965/2026 de Boa Vista dependia de uma entrada histórica mutável e acessou `classification` de um resultado ausente. A correção usa fixture isolada para o comportamento. Não existe recibo dessa edição no estado conferido; a correção não executa retroativamente um envio perdido.

`weekly.mjs` e `sendMessages` enviam texto, não tabela anexa. O destino é o segredo `WHATSAPP_WEEKLY_GROUP_ID`, com alternativa para o destino padrão; o código não comprova o nome do grupo. Não foi alterado destino nem presumida autorização para novo envio a outro grupo. O painel/CSV são publicados em fluxo próprio, conferido separadamente. A prévia reconstruída da semana 24–31/10 é somente para conferência; não é recibo nem reprodução exata do que seria selecionado pelo código antigo.

## Limites

Cinco documentos originais permanecem sem íntegra por HTTP 400/403 ou verificação antibot; têm tentativa e próxima janela persistidas. Não foram rejeitados pelo bloqueio. Notícias novas de outra coleta são contadas separadamente do lote de 51. Nenhuma taxa de acerto geral foi estimada a partir desta amostra de falhas. Testes aprovados não comprovam acesso a todas as fontes nem eliminam a necessidade de amostrar confirmações e rejeições futuras.
