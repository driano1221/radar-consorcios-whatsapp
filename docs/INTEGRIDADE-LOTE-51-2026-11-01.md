# Integridade do lote de 51 e persistência das tentativas

## Falha comprovada

Na automática [41350666337](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41350666337), checkout `cb85243`, a coleta retornou 436 itens e selecionou zero envios. O teste posterior `pending-51-integrity.test.mjs` falhou na validade de uma decisão por fonte alternativa. A proteção reteve o catálogo novo; somente o estado operacional foi persistido em `f39c577`. Não se deve remover essa proteção para publicar o catálogo.

A reprodução com esse estado mostrou que `upgradeLegacyTriage` alterava o caso **CISGA investe R$ 365 mil em caminhonete** (`23fb9982…`). A rejeição final já estava comprovada e selada na camada de fontes alternativas, mas a linha original ainda carregava uma pendência técnica de leitura. O novo limite de acesso convertia essa linha em barreira de entrada. Essa alteração fazia a decisão alternativa deixar de satisfazer sua condição de elegibilidade, mesmo sem mudar seu hash de origem.

## Correção compartilhada

Antes de atualizar uma pendência, `upgradeLegacyTriage` agora verifica a decisão alternativa concluída com o validador já existente. Uma alternativa íntegra e concluída tem prioridade sobre a falha de leitura do original. Não é uma exceção pelo ID do CISGA: vale para aceitação, rejeição e duplicata comprovadas. Fonte alterada, hash incorreto ou vínculo inválido não ganham essa proteção. As decisões humanas continuam com prioridade.

O teste reproduz duas atualizações completas de uma alternativa concluída e uma leitura bloqueada independente, com persistência e reabertura do arquivo. Também corrompe a fonte alternativa e verifica que ela não é cegamente aceita. O teste original de integridade dos 51 continua intacto.

## Tentativas independentes da aprovação editorial

O backfill regular, quando `--apply` e `PERSIST_STATE=true`, grava atomicamente as falhas reais em `state/news-state.json.recoveryFailures` assim que as processa. Esse ponto de controle contém somente ID público do documento, horário, contagem, erro, URL resolvida, próxima janela e execução de origem; não contém decisão editorial ou texto da notícia.

O workflow já salva esse estado mesmo quando a validação do catálogo falha. A coleta posterior restaura os metadados antes de selecionar uma nova tentativa e antes de concluir a triagem. Assim, um catálogo retido não apaga a falha observada nem provoca uma repetição precoce. A restauração é idempotente, respeita uma leitura posterior e não incrementa contagem por releitura do mesmo ponto de controle. Uma leitura bem-sucedida não é declarada por esse mecanismo: continua exigindo o texto preservado.

Prévias e manutenção sem persistência operacional não escrevem esse ponto de controle. Fila, recibos, contadores de envio, sessão e revisões não são entradas de reclassificação nem são reescritos pela restauração.

## Recuperação da rodada que falhou

As três falhas confirmadas nos logs de `Atualizar base histórica de consórcios` foram recuperadas sem repetir requisições às fontes: duas respostas `destino_nao_html` e o HTTP403 do CISAMAPI. A origem e os horários observados constam em `data/catalogo/recuperacao-run-41350666337.json`. O horário importado significa **falha observada no log**, não o início exato da requisição. A próxima janela foi calculada conservadoramente a partir dessa observação, pela mesma regra do leitor.

Para o CISAMAPI, a contagem vai de 1 para 2, com nova tentativa permitida a partir de **01/11 às 22h12 de Brasília** (02/11 às 01h12 UTC). Não houve abertura confirmada: o erro continua HTTP403. Não foi feito teste adicional para forçar sucesso.

## Verificação e continuação

O estado real de `f39c577` foi reproduzido em cópia isolada: atualização do catálogo, restauração dos fatos de leitura, duas novas atualizações e suíte completa posterior. Os manifestos históricos, fontes alternativas, revisões e textos anteriores foram comparados por hash. Na cópia operacional, somente `recoveryFailures` é acrescentado ao estado; os demais campos devem coincidir integralmente, incluindo fila e recibo do resumo aprovado.

Comandos normais: `npm test`, `npm run catalog:update` e `npm run dashboard:build:public`. A atualização de catálogo usa textos e estado já guardados; não consulta provedores de IA ou WhatsApp. Não executar coleta ou backfill de rede para reproduzir essa falha. Para uma rodada futura, distinguir CI/publicação aprovada de uma coleta automática real e conferir o ponto de controle, o catálogo validado e o painel publicado.
