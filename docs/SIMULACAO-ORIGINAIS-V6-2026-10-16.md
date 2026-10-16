# Simulação v6 — assembleia realizada e deliberação histórica em projeto

## Escopo e segurança

Pedido: corrigir Mulheres das Gerais e CISAMREC, repetir a simulação com outros textos e mostrar antes/depois, **sem ativar e sem enviar WhatsApp**.

Trabalho isolado na branch `test/original-triage-v6`. Nenhum módulo experimental é importado pelo coletor, catálogo ou remetente de produção. `data/`, `state/`, `src/` e `config/` ficaram intactos. Nenhuma proposta foi aplicada à base ou ao painel; nenhum histórico foi reenviado.

- Leitura nova da IA: [execução 38978672314](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38978672314), commit `9c003f3`.
- Validação final com respostas congeladas: [execução 38979368650](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38979368650), commit `31dc6b9`.
- Política do modelo `original-shadow-6.0`; regras finais `original-rules-6.2`.
- 118 chamadas únicas, zero erros da API; 440.430 tokens de entrada e 35.450 de saída. A repetição final fez **zero chamadas novas**, reutilizando as respostas originais. O campo `usage` do replay descreve a leitura inicial, não consumo adicional.
- Workflow final sem segredos, apenas permissão de leitura, sem acionamento do coletor/remetente ou publicação do painel.
- Preservadas 6 revisões documentais, 5 PDFs e 14 referências a trechos/páginas. Essas correções não foram substituídas por notícias menos completas.

## Os dois casos pedidos

| Caso | Antes | Depois na simulação | Limite preservado |
| --- | --- | --- | --- |
| Mulheres das Gerais / Casa Sempre Viva | Regra GERAL e IA ATUAÇÃO: retido | ATUAÇÃO: assembleia do próprio consórcio realizada, com participação do MPMG | Discussão não comprova acordo, recursos, ampliação de atendimento ou nova adesão |
| CISAMREC / PL 11/2026 de Passo de Torres | Prova escolhida no dispositivo proposto: retido | GOVERNANÇA: projeto relata deliberação anterior dos consorciados, em **2025** | Não comprova ratificação municipal sancionada; ata mencionada não foi conferida neste teste |

No primeiro caso, “participou de uma assembleia do Consórcio” é corroborado por “Durante o encontro […] abordaram”. O consórcio é titular da assembleia; o Ministério Público é participante. Isso é diferente de um consórcio apenas assistir a evento alheio.

No segundo, o dispositivo proposto “ficam ratificadas” não basta. A evidência útil é a oração que afirma que o contrato “foi consolidado e deliberado pelos entes consorciados” na AGO de 30/10/2025. Conservamos **ano relatado: 2025**, natureza histórica e origem no projeto — não inventamos sanção em 2026.

Fontes preservadas: [Mulheres das Gerais](https://ribeiraodasneves.net/component/tags/tag/1976-consorcio-intermunicipal-de-mulheres-das-gerais) e [PL de Passo de Torres](https://www.passodetorres.sc.leg.br/tramitacoes/2/6359/0). Foram utilizados os corpos integrais já armazenados, com hashes e vínculo de origem; não houve nova coleta destes sites nesta rodada. A primeira URL é uma página de tag cujo corpo armazenado contém a notícia: não a apresentamos como ata primária.

## Antes/depois agregado

Contagem de **publicações-raiz**, não de consórcios únicos nem de fatos novos no mundo:

| Conjunto | Aceitas | Descartadas | Retidas | Separadas por processo |
| --- | ---: | ---: | ---: | ---: |
| 106 anteriores — resultado v5 | 54 | 47 | 3 | 2 |
| 106 anteriores — primeira leitura v6 | 50 | 46 | 8 | 2 |
| 106 anteriores — validação final v6 | **56** | **47** | **1** | **2** |
| 12 textos adicionais — primeira leitura v6 | 4 | 4 | 4 | 0 |
| 12 textos adicionais — validação final v6 | **8** | **4** | **0** | **0** |

Entre as 106 raízes anteriores, as únicas mudanças finais de destino foram os dois casos solicitados: retidos → aceitos. Os 101 aceites/descartes já concluídos conservaram seu destino. Isso não significa que a primeira leitura foi perfeita: as regressões intermediárias foram preservadas e corrigidas, não ocultadas com novas tentativas de modelo.

As duas publicações do TCE continuam separadas em cinco segmentos. Os dois da notícia mais recente foram aceitos. Os três da notícia antiga continuam retidos nesta leitura só do original. Na primeira leitura v6, um segmento sem resultado explícito foi indevidamente proposto para descarte; a proteção final mantém esse segmento aguardando o documento primário. **Falta de resultado no trecho não é motivo para descartar um processo.**

O caso-raiz remanescente é Divinópolis, cuja notícia não individualiza suficientemente o consórcio. Divinópolis e os três atos antigos do TCE já possuem correções por documentos primários na base; sua integração prevalente nesta nova política ainda precisa ser validada. A divergência de número/nome do CONSANE permanece preservada, sem correção automática por semelhança.

## O que a repetição revelou e o que foi corrigido

1. **Nome omitido no JSON:** quando a própria IA cita apenas o nome integral literal do consórcio no campo de identidade, esse nome pode preencher o campo omitido. A citação deve ser localizável e inequívoca. Não consultar cadastro externo, fabricar sigla ou aproveitar nome de município.
2. **Tipo genérico em atividade comprovada:** `outro` pode virar atividade sediada somente quando as duas provas demonstram consórcio + verbo passado + oficina/curso/seminário. Tipo contraditório, evento futuro ou prova ausente continuam bloqueados.
3. **Prova boa no complemento:** em recomendação do MP, a frase exata da entrega, selecionada pela própria IA no complemento, pode ser usada como prova principal. Não inserir prova que o modelo não citou. A saída é CONTROLE, sem transformar suspeita em crise institucional definitivamente comprovada.
4. **Boato negado:** notícia curta que nega encerramento e relata apenas proposta de união, sem outro ato concreto, fica fora. A ocorrência de outro ato institucional impede esse descarte automático. A IA havia marcado CRISE apesar de reconhecer que se tratava de boato.
5. **Variação de assembleia realizada:** município que sediou assembleia do consórcio, com relato do encontro, também prova atuação. Pauta de comodato ou obra não vira contrato assinado/obra entregue.
6. **Aula inaugural já ministrada:** prova de recebimento pelo consórcio mais realização da aula sustenta atuação, sem afirmar conclusão do curso.
7. **Consolidação estatutária promulgada:** lei e dispositivo expresso sustentam governança; minuta/projeto não recebem essa regra.
8. **Aprovação de projeto de protocolo:** harmoniza PROTOCOLO/ADESÃO AUTORIZADA apenas com provas concordantes de aprovação legislativa. A etapa continua “projeto aprovado”, sem inferir sanção nem ingresso efetivo.

As respostas brutas ficam intactas. Reparos, evidência original do modelo, justificativa original e citação efetivamente usada ficam registrados separadamente. Categorias, identidade, versão, hashes, incerteza e multiplicidade continuam sendo verificados.

## Amostra adicional e limites da avaliação

12 corpos distintos dos 106 anteriores, selecionados e congelados antes das chamadas, com no máximo duas fontes do mesmo domínio. Seis já tinham revisão editorial, seis não. Há republicações e episódios conhecidos: **não são 12 notícias recém-coletadas nem 12 fatos inéditos**. A referência prévia foi feita pelo assistente aplicando as decisões de escopo do usuário, não por avaliador humano independente. Nenhum veredito foi enviado à IA.

Exemplos de resultados finais:

- ABC/Braskem: reunião realizada; não investimento contratado.
- ABC + Seguro: início da segunda fase; não entrega dos estandes virtuais previstos.
- CEMMIL: consolidação estatutária ratificada por lei; não criação.
- CISAN/Jaru: assembleia realizada; não aprovação automática de tudo que estava na pauta.
- ABC/ATHIS: aula inaugural realizada; não conclusão do curso.
- Concurso 08 de Abril: descartado; distribuição de vagas por cidades não comprova composição municipal.
- Portaria de Nova Olímpia: descartada; designação de fiscal de contrato municipal com fornecedor não é sanção ao consórcio gerenciador da ata.
- CIGEDAS: concurso descartado; exemplos de cidades da região não são lista de consorciados.

Resultado final: 12/12 destinos coincidentes com a referência prévia, nenhum falso aceite/descarte identificado nessa amostra de raízes. Quatro desses casos ajudaram a aprimorar as regras depois da primeira leitura, portanto o resultado final **não é medida independente de precisão nem garantia de 100% em produção**.

## Testes, reprodução e próximo passo

494 testes passaram localmente e na execução final do GitHub Actions. O artefato remoto foi baixado e comparado: resultados, totais e propostas coincidem integralmente com a reprodução local. Testes, auditoria de evidências e proteção dos arquivos concluíram com sucesso. Cobrem os documentos reais, entidades/anos renomeados e casos negativos: futuro, negação, presença passiva, chamada de notícia relacionada, evidência de outro ato, minuta, nome inventado, campo malformado, duas assembleias, versão/hash incorretos e segmento sem resultado. Auditoria final verificou 170 intervalos de evidência e prova literal em 117 unidades decididas (contagem inclui filhos, não diretamente comparável à tabela de raízes).

Reproduzir sem rede/modelo:

```sh
npm test
node scripts/simulate-original-v6.mjs --frozen
node scripts/audit-original-v6.mjs output/original-v6/report.json
```

Arquivos: `simulacao-v6-amostra-nova.json`, `simulacao-v6-referencia-previa.json`, primeira saída `simulacao-v6-resultado.json` e saída final `simulacao-v6-replay-resultado.json`.

**Não ativado.** Antes da ativação, testar uma amostra realmente não usada nos ajustes e validar a integração com documentos primários, precedência de revisões humanas, deduplicação e bloqueio de alertas históricos. Este experimento demonstra melhora da leitura e da validação, não substitui essa etapa de integração.
