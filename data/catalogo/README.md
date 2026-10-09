# Base histórica do Radar Consórcios

Esta pasta guarda **documentos encontrados pelo radar**, não uma lista oficial e definitiva de consórcios ou de seus membros. Ela é atualizada nas execuções persistentes do GitHub Actions, independentemente de a notícia ser enviada ao WhatsApp.

## Por onde começar

- `resumo.md`: panorama legível, contagens por tema e links recentes para conferência.
- `eventos.csv`: visão para Excel com registros que o classificador relacionou a criação, adesão, saída, protocolo, rateio, finanças, governança, atuação, controle ou crise. Revisões editoriais marcadas `nao_evento` são excluídas desta tabela, mas continuam no arquivo bruto. Apenas registros com `situacao_analise` iniciada por `confirmado por revisão editorial` foram aceitos manualmente; os demais ainda são candidatos ou correções parciais.
- `revisoes-eventos.ndjson`: decisões humanas por documento (`confirmar_evento`, `corrigir_categoria`, `nao_evento`), justificativa, evidência e fatos extraídos. O hash do trecho impede aplicar uma decisão antiga a texto alterado.
- `consorcios.csv`: cadastro de **identidades candidatas** com chave estável `id`, denominação, sigla, CNPJ quando o trecho o associa explicitamente ao consórcio, variações de nome e quantidade de documentos vinculados. Não é um cadastro oficial validado.
- `participacoes.csv`: uma linha por relação município–consórcio **confirmada em revisão documental**. `ano_ingresso` fica vazio se o ato não o informar; `ano_ultima_evidencia_participacao` é o ano de publicação do documento que comprova a participação, não o ano da adesão nem garantia da composição atual. Cada linha traz o documento e o link de origem.
- `vinculos-documentos.csv`: uma linha por menção explícita, ligando o `id` de `arquivo-coletas.ndjson` ao `id` do consórcio, com origem e evidência. Um documento pode mencionar mais de um consórcio. Vínculo não comprova adesão nem veracidade do evento.
- `identidades.ndjson`: registro técnico persistente das identidades e aliases; conserva a chave quando CNPJ ou variação de nome aparece depois. Divergência de CNPJ fica sem vínculo e exige revisão humana.
- `identidade-pendente.csv`: documentos potencialmente relevantes cujo trecho não sustenta um vínculo seguro; é a fila de conferência da identidade, não uma lista de consórcios inexistentes.
- `revisoes-identidades.ndjson`: exceções editoriais lacradas ao hash do trecho. Uma sigla ou nome ambíguo permanece pendente até que o documento permita identificar a entidade sem adivinhação.
- `arquivo-coletas.ndjson`: arquivo técnico de todos os documentos recuperáveis do histórico, inclusive os classificados como `GERAL`, para auditoria e futura reclassificação. Uma linha JSON por URL canônica.

## Como ler um evento

`tipo_evento` é uma hipótese de classificação. `etapa` distingue projeto, autorização, ato publicado e relato. `situacao_analise` distingue candidato, revisão por IA, publicação no WhatsApp e rejeição. **Nenhum desses campos comprova sozinho que um município entrou ou saiu de um consórcio.** Por isso `efeito_na_participacao` permanece “não inferido automaticamente” até haver revisão documental específica.

`decisao_base` e `decisao_alerta` são decisões diferentes: um acontecimento pode estar **confirmado** na base e ser **histórico** para o WhatsApp. `data_fato` guarda apenas uma data exata comprovada; `mes_fato` registra mês conhecido sem inventar dia; `data_noticia_original` vem da página da fonte, não do Google. O alerta usa primeiro a data do fato, depois a data expressa no título de um ato formal, depois a data original da página e, por último, a data da coleta. A janela padrão de novidade é de sete dias. Quando a data original não está disponível, a decisão conserva essa limitação; não presume que a data do Google é a data do ato.

Cada linha mantém título, data da publicação, município/UF quando conhecidos, fonte, URL, um pequeno trecho de evidência e datas da primeira/última coleta. Campos vazios indicam informação não identificada com segurança, não ausência do fato. O arquivo técnico omite o texto integral e mascara CPF e e-mail nos trechos para não duplicar dados pessoais desnecessariamente.

Registros marcados como **“legado sem texto”** correspondem a envios antigos cujo trecho original não foi preservado. Eles permanecem na base para rastreabilidade, mas exigem abrir o documento antes de qualquer uso analítico.

## Atualização e limites da recuperação

`npm run catalog:update` acrescenta/atualiza o que está no estado atual e reaplica a decisão de novidade às linhas históricas de `eventos.csv`. `npm run catalog:backfill` também percorre as versões de `state/news-state.json` existentes no histórico Git. A carga retroativa recupera **o que foi preservado nessas versões**, não publicações que nunca foram coletadas nem o texto integral que o radar já descartou. Documentos repetidos na mesma URL são consolidados; fontes distintas sobre o mesmo fato ainda podem aparecer como linhas separadas na base para preservar a proveniência. No envio, o radar compara também o endereço original da página e a identidade do ato quando município e número da lei estão explícitos.

A base é versionada no repositório e não exige serviço externo. Revisão humana, resolução de identidade dos consórcios e confirmação da composição municipal são passos posteriores; não devem ser inferidos automaticamente apenas de uma notícia, projeto de lei ou contrato de rateio.

## Identificação de consórcios (primeira etapa)

A extração automática é conservadora: aceita o nome explícito fornecido pela fonte ou uma denominação completa acompanhada de sigla no título/trecho. Valida os dígitos do CNPJ e só o associa quando aparece próximo à denominação e no contexto do próprio consórcio. Não usa correspondência aproximada nem cria entidade a partir de “consórcio intermunicipal” genérico. Menções cortadas ou sem texto ficam sem vínculo até haver documento melhor.

`id` é uma chave técnica imutável para o cadastro local; **não substitui o CNPJ**. Duas denominações só são unificadas automaticamente quando o nome normalizado ou o CNPJ validado coincidem. Siglas isoladas não bastam para unir entidades, pois podem ser ambíguas. Os resultados permanecem marcados como candidatos até conferência documental.
