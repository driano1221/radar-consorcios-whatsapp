# Revisão dos treze históricos restantes

Os 13 registros antes incompletos foram revisados em 16 de outubro de 2026: cinco acrescentam fatos, quatro são duplicatas e quatro ficam fora da base. Nenhuma mensagem foi enviada. O acervo continua com 1.946 publicações e o painel passa de 110 para 115 fatos confirmados.

## Antes e depois

| Caso | Antes | Resultado com a leitura recuperada |
|---|---|---|
| Indaiatuba, `afae42c5` | Sem leitura integral | Duplicata do despacho do PL 74/2024 já revisado; PDF idêntico, página 1. Encaminhamento para parecer não comprova aprovação. |
| Dois textos Progov, `c415a567` e `cc60e177` | Descartes com texto insuficiente | Descartes confirmados por escopo: premiação e seminário municipais sem consórcio como ator. |
| Três textos ABC–Metodista, `1bb8aa8d`, `68160372`, `a22322a6` | Recuperações incompletas | Três fontes do acordo de setembro já confirmado em `ca8c07d2`; nenhum novo fato. Não afirmar bolsas concedidas. |
| Conclima, `74fb6772` | Original CNM bloqueado; título citava SC | Aceito como protocolo assinado por prefeitos de 12 municípios do Paraná, usando reprodução no portal do consórcio. Não comprova ingresso consumado. |
| ABC e GCM, `b940d094` | Leitura incompleta | Visita técnica realizada: atuação comprovada, sem capacitação entregue presumida. |
| ABC e Braskem, `f46c947c` | Leitura incompleta | Reunião realizada: atuação, sem contrato ou investimento executado presumido. |
| Acolhimento e AMURC, `0c2c9c6b` | Notícia de seleção incompleta | Aproveitada apenas composição explícita: Curitibanos, Frei Rogério, Ponte Alta do Norte e São Cristóvão do Sul. |
| ABC e plano climático, `cfbb82ef` | Leitor falhava com charset inválido | Reunião do GT realizada. Plano ainda em discussão, não aprovado nem executado. |
| CIMCERO, `e41368d4` | Captura genérica da página institucional | Descartada simples convocação da 121ª assembleia. API pública recuperou a notícia correta e suas pautas futuras. |
| Correios e bancos, `e64cf89d` | Leitura incompleta | Consórcio bancário, não intermunicipal. Crise dos Correios não é crise de consórcio público. |

## Proveniência e limites

Doze textos vêm dos destinos originais. A única fonte alternativa é a [reprodução oficial do Conclima](https://conclima.org.br/municipios-do-parana-subscrevem-o-protocolo-de-intencoes-do-conclima/). Ela permanece em `fontes-alternativas.ndjson`, separada do original CNM, com link, hash, texto, motivo da associação e indicação de que não constitui confirmação independente. A página da CNM continua bloqueada; não houve solução de CAPTCHA nem simulação de acesso ao original.

As quatro participações do consórcio de acolhimento têm **ano da evidência 2026 e ano de ingresso vazio**. Não foi atribuída a sigla AMURC ao consórcio nem criado CNPJ. Os doze municípios do Conclima não foram nomeados na notícia: não foram inventadas relações individuais.

O critério de incluir a composição e a atuação realizada foi aprovado pelo usuário. A leitura documental foi feita pelo assistente. Esses registros são revisões explícitas, não prova de que o classificador genérico acertará todos os próximos casos.

## Correções e validação

- CIMCERO: leitura da mesma API pública utilizada pelo site; verifica ID, título e corpo, sem capturar rodapé ou notícias relacionadas.
- Portal Opinião Pública: trata `charset=iso-utf-8` inválido usando a declaração UTF-8 do HTML; não força Latin-1 nem ignora falha de decodificação sem critério.
- Identidade: um verbo antes da sigla impede associar a GCM do local visitado ao Consórcio ABC.
- Participações: uma revisão pode comprovar vários municípios, cada um em sua relação, sem copiar CNPJ municipal único para todos.
- 394 testes Node locais passaram. Cobrem prova literal, hashes, duplicatas, relações municipais, identidade, separação original/alternativa, alertas e resumo semanal. As quatro rotas afetadas também abriram em teste local real.
- A aplicação verifica que os outros fatos e todos os originais ficaram intactos. Reexecutar `node scripts/apply-historical-thirteen.mjs --apply` não grava nem duplica. Testes reais de leitura não possuem credenciais do WhatsApp nem chamam IA.

O [teste no GitHub Actions](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38948706793) confirmou a suíte, idempotência e as quatro leituras reais: duas páginas do Portal Opinião Pública, API do CIMCERO e reprodução oficial do Conclima. A comparação final manteve dados e estado sem alterações. A [publicação do painel](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38948707383) concluiu com sucesso.

## Fila restante

O inventário `scripts/inventory-retroactive-backlog.mjs` passou de 13 para **zero registros sem revisão e com lacuna de recuperação registrada** no acervo deste corte. Essa medida não equivale a todos os documentos do acervo terem texto integral, nem a todos os portais funcionarem continuamente.

A ficha pública mostra prova, motivo e link; textos integrais ficam preservados no repositório e no painel local não público. A exportação pública mantém a política vigente de trechos, sem republicar automaticamente todas as íntegras.
