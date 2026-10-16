# Triagem automática — estado em 16/10/2026

## O que já funciona sem pedir uma decisão a cada notícia

1. **Descoberta e leitura:** coletores, Readability/Trafilatura, leitores de portais, PDF e OCR seletivos. CNM usa o conteúdo público estruturado da notícia individual; seu índice fornece apenas um resumo.
2. **Interpretação com evidência:** distingue autorização de ingresso, assinatura de protocolo, ingresso comprovado, atuação realizada, composição já documentada e simples convocação. Reunião conduzida pelo consórcio pode ser atuação; mera presença não. Composição não revela ano de ingresso. Contratos rotineiros com fornecedores continuam fora do escopo.
3. **Novidade:** URL, identidade de ato e assinaturas conservadoras de episódios de atuação evitam contar reproduções como novos fatos. Não é uma deduplicação semântica universal.
4. **Fonte alternativa:** para novos registros elegíveis, compara episódio, datas e entidades; exige concordância entre regra e DeepSeek, justificativa e trechos literais. A decisão pode aceitar ou descartar na base. Cada texto mantém URL, hash e proveniência próprios. Discordância não é resolvida escolhendo arbitrariamente uma leitura.
5. **Envio separado:** novidade, data, fonte homologada, cotas, fila e revisão da IA. Aceitar na base não autoriza reenviar. Revisões históricas e seus bloqueios de envio permanecem protegidos.

## O que ainda falta para depender menos de revisão manual

| Lacuna real | Próxima implementação | Critério de validação |
| --- | --- | --- |
| Texto original relevante ainda pode virar candidato | Política de decisão automática para originais completos, com prova literal, categoria/etapa, identidade ou escopo geral explícito e concordância com a revisão quando exigida | Rodar primeiro em simulação no acervo; comparar com decisões já validadas e inspecionar divergências antes de ativar |
| Texto bloqueado, incompleto ou PDF com muitos atos | Recuperação com tentativas limitadas; identificar ato e página; conferir equivalência da alternativa | Nunca descartar pelo simples 403; não usar trecho de outro ato para confirmar |
| Consórcio/município ambíguo | Identidade apoiada em evidência e cadastro de referência | Não inventar CNPJ nem filiação; orientação geral CNM pode entrar sem entidade específica |
| Casos novos ou discordâncias | Registrar tipo de falha e ampliar testes/regras reutilizáveis | Novos testes negativos e comparação de antes/depois; não criar exceção por ID como regra geral |

A meta é **aceitar ou descartar o conteúdo quando a evidência permitir**. Uma falha de acesso é uma pendência de leitura, não uma conclusão de que não existe fato. Nenhum extrator ou LLM garante acerto de 100% em textos futuros. Revisão manual deve ficar concentrada nas exceções reais, com amostragem de qualidade também dos aceites e descartes automáticos.

## CNM aplicada

- Descoberta ativa: Google Notícias com filtro CNM. Listagem direta `https://cnm.org.br/areas_tecnicas/consorcios/noticias` preparada, mas **desativada após HTTP 403 no Actions**. Abriu localmente; isso não homologa o servidor de produção.
- Coletor preparado limita a três páginas individuais por rodada, com leitor Inertia validando rota, slug, ID, componente, conteúdo e data. O mesmo leitor já é usado em notícias descobertas por outros coletores.
- Resumo da listagem não ocupa o campo de íntegra. Erro de acesso ou leitura adiada mantém o item em prévia sem envio.
- Corte de alertas: data original a partir de **17/10/2026**. A manutenção não chama WhatsApp e não altera o estado de envio.
- Recuperação diária inclui CNM: busca pública e REST público do Conclima, preservando a fonte alternativa. Não é uma API geral documentada da CNM nem garantia de acesso a todas as páginas.
- Orientações gerais de consórcios não recebem uma entidade fictícia. Protocolo, atuação e composição continuam sujeitos ao alcance real do documento.
- Diagnóstico distingue o índice bloqueado, notícias com acesso variável e alternativas disponíveis. O teste reprova uma configuração que habilite a listagem sem leitura real comprovada; com a listagem desativada, registra o 403 sem interromper as outras rotas.

## Onde acompanhar a implementação

`institutional-proof.mjs` interpreta os novos padrões; `event-proof.mjs` integra a classificação; `ai-review.mjs` limita a reinterpretação pela IA; `alternative-triage.mjs` decide usando fontes alternativas; `catalog.mjs` aplica revisões e decisões válidas; `publication-gate.mjs` controla elegibilidade de alerta. `cnm-reader.mjs` e `sources/web-scrapers.mjs` fazem leitura e coleta CNM. O fluxograma do painel distingue a base e o envio e mostra a recuperação alternativa.

As revisões anteriores de 10, 13 e 4 registros são lotes históricos auditados, não prova de que todos os documentos futuros já dispensam conferência. Os testes de aplicação idempotente protegem esses lotes contra duplicação e reenvio.
