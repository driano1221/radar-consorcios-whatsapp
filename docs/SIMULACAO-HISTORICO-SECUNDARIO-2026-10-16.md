# Complemento — histórico institucional de fonte secundária

## Decisão do usuário

Em 16/10/2026, durante a auditoria da amostra nova, o usuário autorizou **aproveitar o histórico institucional explicitamente relatado em fonte secundária**, sinalizando essa condição. O concurso em si continua fora da base. Não há autorização para apresentar informação secundária como conferência do ato original ou como criação recente.

## Implementação apenas experimental

- Regra geral do protótipo identifica nome de consórcio intermunicipal público e afirmação de constituição com ano explícito dentro de matéria de concurso. Não há exceção por ID/CONSUD.
- Proposta preserva `reportedYear: 2023` e `sourceQualification: fonte_secundaria_ato_original_nao_conferido`.
- Etapa: “constituição relatada em 2023 por fonte secundária; ato original não conferido; concurso não é o fato”. Não cria CNPJ, municípios participantes ou ingresso em 2023.
- Testes negativos incluem hipótese (“seria estabelecido”) para não converter intenção em fato. Esse teste revelou uma falha inicial, corrigida antes da validação final. A primeira tentativa [38960111608](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38960111608) parou nos testes e não chamou IA.

## Resultado real, sem esconder a divergência

[Execução suplementar 38960181674](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38960181674), commit `892d8edcb7b6d70d69b4c4792728e4863f883133`: **437 testes passaram**, uma chamada de IA, arquivos protegidos intactos, zero WhatsApp.

Caso: [histórico do CONSUD em matéria de concurso](https://www.estrategiaconcursos.com.br/blog/concurso-consud-pr/), documento `20264127`.

| Camada | Resultado |
| --- | --- |
| Regra anterior | RATEIO genérico, celebração a conferir |
| Regra experimental após sua decisão | CRIAÇÃO histórica relatada, ano 2023, fonte secundária |
| DeepSeek | Reconheceu o mesmo histórico e o ano, mas chamou a categoria de GOVERNANÇA |
| Proposta final | **Retida por divergência de categoria; nada aplicado** |

As duas leituras reconhecem o conteúdo histórico, mas ainda divergem no rótulo. Não repetimos a chamada até obter a resposta desejada nem afrouxamos a exigência de concordância. Próxima melhoria: distinguir a validação do fato/etapa do vocabulário das categorias, com mapeamento determinístico e prova, antes de ativar.

O replay local das regras nos 244 textos elegíveis mudou somente o caso CONSUD após essa nova política. Os números da execução completa dos 70 continuam congelados na versão anterior; este teste suplementar não os reescreve. A política e os testes estão na branch experimental, não no fluxo ativo.
