# Textos originais: simulação v4, sem ativação

## Conclusão

**Ainda não ativar a política para todos os originais.** A repetição preservou os resultados conhecidos, mas a amostra não usada nos ajustes revelou um descarte incorreto e duas limitações de leitura. Coleta, política atual e publicação do painel continuam independentes deste experimento.

- Execução: [38975839429](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38975839429), commit `929d852`, branch `test/original-triage-v4`.
- 459 testes aprovados no Actions; 12 chamadas DeepSeek novas, sem erros de API; 33.407 tokens de entrada e 2.729 de saída.
- Zero chamadas ao WhatsApp. `data/`, `state/`, `config/` e `src/` não foram alterados pela simulação. Workflow sem credencial de WhatsApp, com permissão somente de leitura do repositório.
- Não aplicamos propostas na base nem publicamos essas propostas no painel.

## Antes e depois

| Grupo | Antes/referência | Resultado desta rodada |
| --- | --- | --- |
| 82 originais conhecidos | 47 aceites, 33 descartes, 2 retenções | Mesmas 82 decisões; zero mudanças |
| 12 textos inéditos para este teste | Leitura prévia: 2 aceites, 9 descartes, 1 retenção para desdobramento | 1 aceite, 9 descartes, 2 retenções |
| Correções documentais já aplicadas | Divinópolis e três atos do TCE; divergência CONSANE preservada | 6 revisões, 5 PDFs e 14 referências de prova preservadas; sem alertas históricos |

Nos 82, reutilizamos respostas congeladas para isolar o efeito da política/dos dados atuais; **não são 82 novas leituras do modelo**. Um vínculo de metadados foi atualizado por mudança na data original, mantendo o mesmo corpo e hash. As 12 chamadas novas usaram corpos distintos, fora dos 82 anteriores, sem revisão editorial prévia, máximo dois por domínio. Seleção determinística, estratificada por regra, não representativa do universo.

A referência dos 12 foi escrita pelo assistente com os critérios já definidos pelo usuário e incluída no commit antes das chamadas. Não é validação humana independente. Dez rótulos coincidiram, mas isso **não equivale a 83,3% de precisão geral**: houve um descarte indevido e uma retenção que ocorreu por motivo diferente do esperado. A amostra tem poucos positivos.

## O que a amostra nova revelou

| Caso | Resultado | Avaliação |
| --- | --- | --- |
| CISGA, 100 procedimentos de YAG Laser | Aceite de atuação | Conteúdo sustentado; mesmo episódio já registrado em `a229b70e…`, portanto não é automaticamente um fato novo |
| TCE-PR, fichas dos acórdãos 726/2019 e 495/2017 | Descartes como fatos diretos | Correto: a ficha deve descobrir o PDF, não inventar resultado. No CONSUD, a IA tentou aceitar; a regra explícita impediu |
| TCE-MG, CIMARG e CIMINAS em duas decisões | Retido | Seguro, mas incompleto: IA disse que não eram múltiplos atos. A retenção ocorreu por falta de etapa/prova na regra, não por desdobramento correto |
| SAFI, Alto Uruguai, Lambari | Descartes | Seleção de pessoal sem outro fato institucional sustentado |
| CISA, contrato temporário de enfermagem | Descarte | Rotina de pessoal, sem comprovação de atendimento realizado |
| Prova Nacional Docente | Descarte | Adesão a exame, não a consórcio |
| Campos de Júlio, aquisição de ambulância | Descarte | Adesão à ata de preços, não ingresso municipal |
| ABC Agora, certificados dos GCMs | **Descarte incorreto** | Cerimônia futura, mas o texto afirma capacitação promovida e curso concluído. Regra e IA perderam o fato secundário já realizado |
| CIS-VERDE, seleção administrativa | Retido | IA alterou `o Consórcio` para `O Consórcio` na citação; o verificador literal bloqueou. Não é falta de texto nem dúvida de escopo |

Exemplos verificáveis:

- [ABC Agora](https://abcagora.com.br/2026/09/23/gcms-abc-curso-corregedoria/): “A capacitação foi promovida em parceria” e “GCMs que concluíram o curso”. Aproveitar apenas a capacitação, não antecipar a entrega dos certificados.
- [TCE-MG](https://www.tce.mg.gov.br/noticia/Detalhe/1111629256): processos 1214503 (CIMARG) e 1210634 (CIMINAS). Devem ser tratados individualmente; verificar episódio já existente antes de acrescentar fatos.
- [CISGA](https://rededanoticia.com.br/atendimento-oftalmologico-consorcio-viabiliza-procedimentos-de-yag-laser-para-100-pacientes-do-araguaia/): atuação válida, mas relevância não equivale a novidade.

## Ordem recomendada antes de ativar

1. **Corrigir a unidade de leitura:** identificar fatos secundários concluídos em notícias de agenda; separar processos/atos e seus destinatários antes da decisão. Acrescentar negativos (curso ainda futuro, presença passiva, certificado anunciado sem curso comprovado).
2. **Reparo limitado de evidência:** quando as leituras concordam, localizar novamente no corpo o trecho exato e sua posição, ou pedir uma única correção de citação. Nunca aceitar paráfrase como prova nem executar retries sem limite.
3. **Repetir os 94 como regressão e testar outro lote não usado nos ajustes**, com mais positivos. Esta amostra deixa de ser independente depois que for usada para corrigir regras. Não medir qualidade apenas pelo número de candidatos eliminados.
4. **Integrar sob chave de ativação, inicialmente sem envio:** preservar revisão humana, registrar versão/hash/URL/trechos, aplicar deduplicação por episódio, testar idempotência e garantir que revisão histórica não altera fila de alertas. Validar no Actions antes de liberar só casos novos elegíveis.
5. **Exceções técnicas explícitas:** PDFs/diários multiatos, fontes bloqueadas e divergências reais não viram descartes por falta de acesso. Automatizar recuperação limitada, com amostragem de aceites e descartes para detectar erros silenciosos.

## Estado operacional conferido

[Coleta 38973555818](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38973555818), iniciada em 16/10 às 19h04 (Brasília): sucesso. Relatórios: 135 itens retornados, 6 relevantes na etapa inicial, 2 candidatos novos avaliados pela IA e rejeitados por rateio sem contrato concreto; zero selecionados para envio. São etapas distintas, não 6 fatos confirmados.

O painel público responde e informa geração às 19h06, com a última coleta às 19h06. Base do experimento: 1.990 publicações arquivadas, 264 corpos armazenados; 245 elegíveis para esta política de originais HTML, 13 reservados à leitura por ato/página, 5 acima de 24 mil caracteres (não truncados) e 1 leitura alternativa. Os 1.726 sem corpo armazenado incluem material fora de escopo e caminhos documentais diferentes; não equivalem a 1.726 notícias relevantes perdidas.

Ressalvas da coleta: timeout no PortalTP de Guanhães; extração parcial AMM-MT; Semana 7 e uma notícia CNM com 403. Índices diretos RNCP/CNM/CISAMAPI continuam desativados com alternativas de descoberta. Essas falhas não derrubaram a rodada, mas impedem afirmar cobertura integral.

Também foi identificado um teste histórico sensível à recuperação legítima de texto em rodada posterior: ele procurava o corpo apenas no lote antigo. A correção consulta o acervo completo para validar o vínculo atual, mantendo as verificações de hash e imutabilidade do lote original. Não é mudança de regra editorial.

Essa correção isolada de teste foi publicada em `main` no commit `90f06ac`, após **424/424 testes de produção aprovados**. Nenhum código de triagem experimental, dado, configuração ou estado de WhatsApp foi incluído nesse commit. O restante desta rodada continua somente na branch de simulação.

## Reproduzir

`node scripts/simulate-original-v4.mjs --replay` repete os 82 e apenas prepara os novos sem IA. `--ai` lê os 12 congelados; não aplica decisões. Para auditar o artefato baixado: `node scripts/audit-original-v4.mjs output/original-v4-ci/report.json`.

Arquivos: `simulacao-v4-amostra-nova.json` (seleção), `simulacao-v4-referencia-cega.json` (referência prévia), `simulacao-v4-resultado.json` (respostas e comparação). As leituras experimentais não são importadas pelo fluxo de produção.
