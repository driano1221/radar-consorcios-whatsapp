# Auditoria exploratória dos 12 textos novos para o experimento

Inspeção do assistente **depois** da execução congelada [38959557626](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38959557626), sem mudar respostas, métricas, revisões editoriais ou dados de produção. Não é validação humana independente. A seleção foi feita por semente fixa, entre textos sem revisão editorial, com seis relevantes e seis não relevantes segundo a regra. Não houve escolha posterior dos casos mais favoráveis.

## Limite importante da amostra

Há **12 URLs, mas nove corpos diferentes**. Quatro URLs reproduzem exatamente a mesma matéria sobre CISVP. Portanto, os três aceites propostos não são três fatos novos. Todos se referem a esse mesmo episódio, que também já foi tratado em outras publicações do acervo. A equivalência de texto apontou três candidatos a duplicata, mas o piloto não aplica deduplicação nem grava fatos.

Mesmo com o corpo idêntico, a IA classificou três reproduções como CONTROLE e uma como CRISE. Isso revela instabilidade e reforça a necessidade de decisão canônica por conteúdo/episódio e de revisão da seleção da prova antes de ativar. Guardar apenas uma resposta em cache evita variação para o mesmo texto, mas não transforma uma resposta errada em correta.

## Leitura caso a caso

| ID / publicação | Resultado do teste | Inspeção posterior e próximo tratamento |
| --- | --- | --- |
| `e672ae7a` — CISVP / Local MT | Aceitar · CONTROLE | Recomendação nº 23/2026 e audiência do MP, não dissolução consumada. Conteúdo relevante, mas corresponde ao episódio já conhecido. |
| `5e27bff7` — CISVP / Passando a Limpo | Reter · regra CONTROLE / IA CRISE | Corpo idêntico ao anterior. Deve compartilhar o episódio e seus limites, não criar uma interpretação independente por portal. |
| `abaee632` — CISVP / NG Notícias | Aceitar · CONTROLE | Mesma reprodução; não é novo acontecimento. Citação da situação jurídica não deve ser apresentada como condenação. |
| `689ca393` — CISVP / Sou News | Aceitar · CONTROLE | Mesma reprodução. A frase escolhida pela IA (“não poderá haver interrupção dos serviços”) é literal, mas fraca para provar a entrega da recomendação. Preferir o trecho que relata a entrega da Recomendação nº 23/2026. |
| `20264127` — Concurso CONSUD PR | Reter · regra RATEIO / IA ATUAÇÃO | A referência a custeio por rateio é genérica; a realização de provas não é o fato institucional buscado. Porém o corpo informa constituição em 2023 a partir da ARSS. **Usuário autorizou aproveitar esse histórico como fonte secundária, sem afirmar conferência do ato original.** Teste suplementar separado, não incorporado retroativamente à métrica dos 70. |
| `473cca93` — Oficina educacional do ABC | Reter · regra GERAL / IA ATUAÇÃO | Corpo afirma que o consórcio sediou a oficina em 14/9 e coordena o observatório com a UFABC. Atuação realizada sustentada; falta generalizar a relação sujeito–verbo “sediou oficina”, preservando a exclusão de mera presença passiva. Não usar o link “Leia também” sobre Metodista como fato desta matéria. |
| `da010f90` — Cinco projetos de Divinópolis | Reter · regra GOVERNANÇA / IA SAÍDA AUTORIZADA | Há aprovação de projeto para autorizar saída, mas o consórcio não é nomeado. Identificar o projeto/entidade em fonte oficial antes de gerar vínculo. Não inventar nome nem afirmar desligamento consumado. A matéria reúne outros projetos sem relação com consórcios. |
| `3c70e982` — Justiça / CISMIV de Viçosa | Reter · regra GERAL / IA CONTROLE | Texto descreve sentença em ação civil pública e obrigações separadas: município em 90 dias; consórcio em 180 dias. Relevante como CONTROLE. Ampliar leitura de sentença/obrigações, sem atribuir o prazo municipal ao consórcio ou inferir trânsito em julgado. |
| `2e4c11e2` — Semana 7 / boato sobre Cisa | Descartar | Texto nega extinção e relata proposta de gestão compartilhada Cisa–Cisax; não comprova fusão, encerramento ou início da gestão. Descarte compatível com os critérios. |
| `73103727` — ABC–Metodista / documentos para bolsas | Reter · regra GERAL / IA COOPERAÇÃO AUTORIZADA | A parceria é descrita como firmada em setembro, enquanto a entrega de documentos ainda é futura. Não é mera autorização de cooperação. Confrontar com o acordo já existente no acervo antes de concluir novidade; a lista de documentos não comprova concessão de bolsas. |
| `72768a78` — Canabrava / intenção de adesão à ata | Descartar | Aviso de carona em ata de registro de preços; não é ingresso do município no CIMCERO. Não gerar vínculo de participação. |
| `b628c35c` — Carapicuíba / seleção CEMMIL | Descartar | Vagas e local de trabalho, sem lista de municípios consorciados ou ato institucional independente. Local de execução não equivale a participação formal. |

URLs, justificativas e provas originais de cada proposta estão na tabela integral do [relatório da segunda simulação](SIMULACAO-ORIGINAIS-V2-2026-10-16.md) e no artefato do Actions. Nenhuma decisão desta auditoria foi aplicada ao acervo.

## Próximos passos, antes de qualquer ativação

1. Vincular versões/republicações ao mesmo episódio, com reuso auditável da leitura por hash do corpo e versão da política. Nunca contar os três aceites CISVP como três acontecimentos.
2. Ampliar regras de atuação realizada (“sediou oficina”) e controle judicial, com provas e destinatários separados.
3. Tratar divergências de categoria e respostas contraditórias da IA: alteração de protocolo existente é GOVERNANÇA; consórcio empresarial em contratação municipal não se torna consórcio público.
4. Separar matérias com processos distintos e recuperar identidade quando o consórcio não está nomeado. Isso não se resolve forçando aceite/descarte por falta de informação.
5. Fortalecer prova do **fato**, não apenas citação literal ou identificação da entidade. A literalidade é necessária, mas não suficiente.
6. Novo conjunto de validação após esses ajustes. Não reutilizar estes 12 como se continuassem inéditos depois de incorporá-los aos testes.
