# Simulação v5 — fatos concluídos, citações e atos independentes

## Escopo e segurança

Solicitação: corrigir ABC, CIS-VERDE e TCE-MG, repetir a simulação com outros textos, sem ativar a nova política ou reenviar históricos. Trabalho isolado na branch `test/original-triage-v5`. Nenhum código deste experimento é importado por `src/`.

- Primeira leitura no Actions: [38976977227](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38976977227), commit `ddc4710`.
- Validação final de regras com respostas congeladas: [38977599670](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38977599670), commit `6a71d03`.
- A primeira rodada fez 106 chamadas únicas para 106 publicações, com dois documentos divididos em cinco segmentos e reaproveitamento de corpos idênticos. Zero erros de API. 365.499 tokens de entrada e 32.882 de saída.
- A repetição final usa as mesmas respostas: zero novas chamadas. Não confundir tokens registrados na leitura inicial com consumo adicional no replay.
- `data/`, `state/`, `config/` e `src/` permanecem intactos. Nenhuma proposta entrou na base/painel. Zero chamadas de WhatsApp. Workflow final sem segredos ou permissão de escrita.
- Correções documentais anteriores preservadas: 6 revisões, 5 PDFs e 14 provas verificadas; não foram substituídas por notícias menos completas.

## Antes e depois dos três casos

| Caso | Antes | Depois |
| --- | --- | --- |
| ABC, curso de corregedoria | Descartava tudo por anunciar cerimônia futura | Aceita somente a capacitação já promovida e concluída; cerimônia continua futura; local do curso não é presumido |
| CIS-VERDE, seleção administrativa | Retido porque a IA trocou `o` por `O` na citação | Descarte sustentado; localizador recupera o trecho exato da fonte e registra início/fim, sem aceitar paráfrase, número diferente ou citação ambígua |
| TCE-MG, notícia com CIMARG e CIMINAS | Retenção sem separar adequadamente os processos | Dois segmentos: 1214503/CIMARG (anexo 1217850) e 1210634/CIMINAS; ambos aceitos como referendos cautelares, não condenações definitivas |

Na notícia do TCE, cada segmento tem hash próprio, vínculo ao hash da íntegra e intervalo no texto original. Um processo não pode usar a prova do outro. O anexo continua vinculado ao primeiro, não gera terceiro fato. Aceitar o conteúdo não resolve sozinho novidade/deduplicação — o episódio CIMARG já tinha evidência no acervo.

## Resultado agregado

| Grupo | Aceitos | Descartados | Retidos | Publicações separadas por processo |
| --- | ---: | ---: | ---: | ---: |
| 94 anteriores — antes | 48 | 42 | 4 | 0 |
| 94 anteriores — primeira leitura v5 | 48 | 42 | 2 | 2 |
| 94 anteriores — regras finais | 49 | 42 | 1 | 2 |
| 12 textos adicionais — primeira leitura v5 | 4 | 4 | 4 | 0 |
| 12 textos adicionais — regras finais e decisão de escopo | 5 | 5 | 2 | 0 |

**Separar não significa resolver todos os filhos.** As duas publicações geraram cinco segmentos: os dois da notícia nova foram aceitos; os três da notícia antiga continuam sem confirmação autônoma suficiente nesse teste de originais. A base já tem as correções desses atos por PDFs, que permanecem preservadas. O número incorreto 1217068 e o nome divergente do CONSANE continuam registrados como constam da notícia, sem correção automática por semelhança com 1217968.

A retenção remanescente entre os 94 é a notícia de Divinópolis sem identidade suficiente no próprio texto. Isso não desfez a correção já aplicada com a lei original.

## Por que fizemos uma segunda avaliação

A orientação nova resolveu o curso, mas o modelo passou a chamar dois artigos de uma única lei de “atos independentes”. A correção final exige uma relação documental explícita:

1. **Mesma lei sancionada:** artigo de autorização de ingresso e artigo de repasse ao mesmo consórcio são aspectos do instrumento, sem afirmar adesão ou pagamento consumados. Duas leis, entidades diferentes ou processos distintos não recebem essa normalização.
2. **Mesma audiência:** recomendação entregue e alternativas de regularização discutidas não viram três decisões executadas. Múltiplas recomendações/audiências não passam por esse ajuste.
3. **Justificativa limitada à prova:** o modelo sugeriu “sediar” no curso do ABC, mas o local do curso não estava demonstrado. A explicação publicada pela proposta usa a etapa comprovada e mantém o texto original do modelo para auditoria.
4. **Exclusões determinísticas preservadas:** um índice/ficha sem resultado não precisa de JSON válido da IA para continuar fora como fato direto. Seus links permanecem pistas para recuperação documental.

Os ajustes foram reavaliados com as respostas congeladas, sem escolher uma nova resposta mais conveniente. A primeira saída foi preservada em `simulacao-v5-resultado.json`.

## Decisão do usuário incorporada somente à simulação

Em 16/10, o usuário determinou: **“Descartar como rotina operacional”** para a portaria CINDVALE que aprova projeto de conservação de rodovias sem comprovar execução.

A regra identifica aprovação técnica de manutenção rodoviária em portaria com responsabilidade de engenharia. Não estende a exclusão indiscriminadamente a novas normas institucionais, obras entregues ou composição municipal explícita. A referência inicial do assistente considerava aceitar esse ato; ela foi preservada, e a alteração de escopo está em `simulacao-v5-decisoes-usuario.json`. Não apresentar essa mudança como ganho autônomo de interpretação da IA.

## Os 12 textos adicionais

Seleção congelada antes das chamadas, com hash, origem e referência prévia. Os corpos são distintos dos 94, mas seis positivos pela regra já tinham revisão editorial e há episódios conhecidos. Não é amostra representativa nem teste totalmente independente de decisões humanas. Nenhuma classificação editorial foi enviada ao modelo; ele recebeu apenas o corpo.

Resultado final contra a referência, atualizada exclusivamente pela decisão explícita do usuário: dez decisões coincidentes, dois casos retidos. Nenhum falso aceite/descarte identificado nessa comparação limitada; não equivale a precisão de 100% em produção.

Retidos adicionais:

- **Mulheres das Gerais / Casa Sempre Viva:** notícia relata assembleia do consórcio já realizada, com participação do MPMG. IA reconhece atuação; regra ainda não vincula com segurança o evento à atuação do próprio consórcio. Não inferir municípios membros a partir dos beneficiários do equipamento.
- **CISAMREC / Passo de Torres:** o projeto de lei relata deliberação anterior da assembleia, mas a ratificação municipal está em tramitação. A prova escolhida pelo modelo usa o dispositivo proposto. O bloqueio impede apresentar a minuta como lei sancionada; falta escolher e validar o fato histórico separado.

Os cinco aceites adicionais incluem duas coberturas do acordo ABC/Metodista, duas da recomendação CISVP e a lei de Juína. **Não são cinco novos episódios na base.** Os cinco descartes incluem nota de pesar, ficha de acórdão, notícia eleitoral, notificação municipal a fornecedor e a aprovação técnica excluída pelo usuário.

## Testes e próximos passos

474 testes aprovados localmente; a execução final no Actions também terminou com todos os testes, replay e verificação de imutabilidade aprovados. O artefato remoto foi baixado e auditado: 85 localizações de prova verificadas, além de checagem literal das evidências das decisões concluídas. Casos negativos cobrem: curso futuro/negado, participação passiva, trecho de “leia também”, números alterados, citação ambígua, lei com vários artigos, anexo de processo, prova de outro segmento, duas audiências/recomendações e limites da exclusão técnica.

Ainda **não ativar**: faltam resolver os dois padrões adicionais, validar outros positivos não usados nos ajustes e integrar a política com deduplicação, preservação das decisões humanas e corte de alertas históricos. PDFs/identidades contraditórias continuam exigindo suas provas próprias.

Reprodução final sem rede/modelo: `node scripts/simulate-original-v5.mjs --frozen`. Auditoria: `node scripts/audit-original-v5.mjs output/original-v5/report.json`. As respostas iniciais, decisões do usuário e avaliação final são mantidas em arquivos distintos.
