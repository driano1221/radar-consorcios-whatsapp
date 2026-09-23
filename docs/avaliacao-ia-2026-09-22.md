# Avaliação pontual de IA — Radar Consórcios

Data: 22/09/2026. Nenhuma IA foi ativada na coleta, classificação ou publicação do radar; o teste não enviou mensagens ao WhatsApp.

## Amostra e método

- 13 casos: 11 registros do histórico do radar e dois controles externos (fundação do SIM Oeste e lei de retirada de Campo Belo).
- 9 fatos relevantes e quatro menções sem evento editorial novo, conforme revisão manual. O caso “consórcio cria agenda” é relevante como atuação, **não** como criação de entidade.
- Perguntas avaliadas: relevância, categoria e se houve constituição de *novo consórcio*. Laya recebeu apenas as duas perguntas binárias; DeepSeek recebeu as três.
- Comparação feita com título, resumo e trecho de evidência disponíveis ao robô, sem buscar o texto integral. Isso limita especialmente casos de notícias com título truncado ou pouco contexto.
- A segunda instrução do DeepSeek foi ajustada após observar os erros da primeira **na mesma amostra**. Seus números indicam viabilidade, não acurácia generalizável. É indispensável uma amostra nova, mantida fora da fase de ajuste.

| Solução | Relevância | Categoria | Novo consórcio |
| --- | ---: | ---: | ---: |
| Regras atuais | 10/13 | 6/13 | 12/13 |
| Laya multilíngue 0.3.6, sem ajuste fino | 8/13 | não testada | 2/13 |
| DeepSeek Flash, instrução inicial | 9/13 | 9/13 | 13/13 |
| DeepSeek Flash, instrução ajustada | 12/13 | 12/13 | 13/13 |

O erro remanescente do DeepSeek ajustado foi um contrato de rateio de Votuporanga: o modelo interpretou cláusulas de um contrato publicado como mera previsão orçamentária e descartou o achado. Em contrapartida, distinguiu “criou agenda” de fundação de consórcio, separou autorização legal de adesão efetivada e rejeitou balanço, RREO, menção orçamentária e contrato rotineiro de serviço. Os 13 trechos citados na primeira rodada eram literalmente encontrados no texto fornecido, mas isso não equivale a verificar a fonte original.

## Custo observado e operação

A segunda rodada usou 9.904 tokens de entrada (3.072 com cache) e 1.182 de saída. Pelos preços oficiais consultados na data, o custo estimado das 13 chamadas é US$ 0,00174 fora de pico ou US$ 0,00349 no pico. Não é uma previsão de fatura mensal: número de candidatos, tamanho dos textos e preços podem variar. A execução pontual com Secret no GitHub Actions passou, sem integrar o fluxo de publicação.

- [Rodada 1 no GitHub Actions](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/35800166379)
- [Rodada 2 no GitHub Actions](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/35800326002)
- [Preços oficiais do DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/)

Os artefatos desses runs são retidos pelo GitHub por sete dias; a amostra é reproduzível pelo script `scripts/eval-ai.mjs` enquanto os registros históricos correspondentes permanecerem em `state/news-state.json`. A saída local do Laya fica em `output/ai-eval-laya.json` e não é versionada.

## Decisão recomendada

Escolher **DeepSeek Flash como candidato a segunda revisão**, não como classificador autônomo ainda. Manter regras determinísticas para seleção inicial e como salvaguarda. Antes de ativar:

1. Testar em modo silencioso por vários dias sobre candidatos novos, sem usar esses casos para reescrever a instrução. Revisar manualmente uma amostra de aceitos e rejeitados, com atenção especial a rateio, autorização versus adesão efetiva e notícias repetidas.
2. Validar JSON, categoria, consistência entre categoria e flags, e existência literal da evidência; resposta vazia, erro, timeout ou decisão incerta não devem virar publicação automática.
3. Impor teto diário de chamadas/gasto e registrar modelo, versão da instrução e decisão para auditoria. Preservar deduplicação e fila existentes.
4. Só depois de medir a taxa de erro na amostra independente decidir quais categorias podem passar automaticamente e quais exigem revisão humana.

Laya não é adequado sem treinamento específico: além de errar o exemplo central, marcou 10 dos 13 casos como criação e rejeitou a fundação real do SIM Oeste. Laya-MLX exige Apple Silicon; FluidUse e jev-ultrafast são voltados a automação de interface/navegação; awesome-jev é uma lista de recursos. Jev não pôde ser avaliado por API neste teste por depender de acesso próprio. Esses projetos não substituem a validação editorial do radar.
