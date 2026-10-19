# Fontes e revisão automática — 19/10/2026

## Diagnóstico

- A execução das 17h35 coletou 83 itens. Treze publicações da AMM-MT tinham o corpo em páginas SVG, sem texto HTML: o seletor retornava vazio.
- O original TCE-MG `1111629256` tinha 4.965 caracteres preservados, mas a revisão recebia resumo e uma janela selecionada que começava no meio de uma palavra. Uma resposta sem citação localizável foi corretamente bloqueada; a falha da segunda passagem não aparecia no relatório agregado do DeepSeek.
- Querido Diário respondeu HTTP 503 com `no available server`. A documentação oficial também publica `https://api.queridodiario.ok.org.br`; localmente essa rota apresentou falha TLS. Isso é indisponibilidade externa, não ausência de notícias.
- Semana 7 já tinha uma íntegra original de 2.060 caracteres preservada. A coleta normal não reutilizava essa leitura antes de abrir novamente a URL bloqueada.
- A orientação tributária da CNM possui reprodução de 2.726 caracteres na AMA. O provedor público WordPress da AMA funciona para descobrir e ler a reprodução; continua sendo outra fonte, não abertura do original CNM.

## Correções

1. Leitor das páginas oficiais AMM: lê os caracteres `data-text` do SVG, conserva as páginas e valida domínio, publicação e sequência. Não inventa texto a partir de nomes de glifos; página ausente ou imagem sem camada textual permanece lacuna explícita. Limites de tamanho/páginas e simultaneidade.
2. As instruções técnicas do SIM seguem a categoria já usada para normas operacionais (`ATUAÇÃO`), sem transformar a citação do protocolo no preâmbulo em alteração constitutiva ou uma regra de suspensão em fiscalização realizada.
3. Revisão recebe artigos de até 24.000 caracteres integralmente. Documentos maiores recebem janelas separadas e indicação de leitura parcial. A evidência deve existir em um único campo; diferenças tipográficas são reconduzidas à grafia literal da fonte. Paráfrases, quantidades alteradas e montagem de citações entre campos continuam rejeitadas.
4. Uma decisão inválida pode receber uma segunda tentativa estrita dentro dos tetos de chamadas. Falha de rede não dispara uma sequência de novas chamadas. Auditoria e saúde agregadas incluem também a segunda passagem.
5. Reutilização de textos íntegros com hash verificado e vínculo ao mesmo editor. Reprodução de outro veículo não pode ser rotulada como página original. Não altera os textos/trechos selados das revisões.
6. Querido Diário tenta as duas rotas oficiais. Havendo indisponibilidade confirmada em ambas, adia consultas restantes e registra o motivo; mantém a cobertura perdida explícita e retenta na rodada seguinte.
7. Busca alternativa CNM inclui a API pública WordPress da AMA, com os mesmos filtros de episódio, datas, quantidades, proveniência e revisão existentes. Não é liberação de alerta para toda reprodução nem mudança retroativa de decisão.
8. Araguaia Notícia: rota AMP pública anunciada pelo editor, com conferência do canônico. Recuperação diária também pode buscar uma reprodução na Rede da Notícia, em camada separada; a busca usa palavras do assunto, em vez de expressões genéricas como “fará em breve”. O nome da CNM com o sufixo `(CNM)`, usado pelo Google, passa a ser reconhecido na recuperação.

## Proteção dos históricos

- `SEND_ENABLED=false` e `PERSIST_STATE=false` nos testes. Workflow dedicado com `contents: read`, sem chaves da sessão/grupo WhatsApp.
- Snapshot de IDs, decisões revisadas, trechos selados, recibos, fila e sessão antes/depois; `git diff` de `data/` e `state/` obrigatório.
- Leitura SVG da AMM habilita alertas somente para publicações a partir de **20/10/2026, 00h, Brasília**. Documentos recuperados anteriores continuam consultáveis no acervo, sem alerta retroativo.
- Controle/fiscalização continua na base/painel e fora do WhatsApp. Não houve disparo de alerta ou resumo nesta manutenção.

## Validação

Local: os 13 documentos recuperados somam 131 páginas, entre 8.044 e 32.805 caracteres por documento. O coletor real da AMM abriu 20 itens sem erro de extração. Araguaia Notícia abriu localmente com 3.568 caracteres. Acesso externo continua sujeito ao ambiente.

Primeira validação no Actions: [39329036298](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/39329036298), **sucesso**. 441 testes; AMM 20/20 com leitura; os 13 antigos somam 131 páginas; CNM via AMA, 2.726 caracteres; Semana 7 original preservado, 2.060. TCE-MG aprovado como Controle em uma chamada, com citação literal no corpo de 4.965 caracteres, e cache testado sem nova chamada. Simulação: 84 itens, um relevante, zero selecionados; 13 leituras originais reutilizadas. Arquivo e estado intactos. Araguaia original continuou 403 nessa primeira execução; segunda validação adiciona a rota AMP e a reprodução via API.

Referência oficial de rotas/uso responsável do Querido Diário: https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html.
