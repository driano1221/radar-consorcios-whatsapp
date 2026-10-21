# Base histórica do Radar Consórcios

Esta pasta guarda **documentos encontrados pelo radar**, não uma lista oficial e definitiva de consórcios ou de seus membros. Ela é atualizada nas execuções persistentes do GitHub Actions, independentemente de a notícia ser enviada ao WhatsApp.

## Por onde começar

- `resumo.md`: panorama legível, contagens por tema e links recentes para conferência.
- `eventos.csv`: visão para Excel com registros que o classificador relacionou a criação, adesão, saída, protocolo, rateio, finanças, governança, atuação, controle ou crise. Pode conter um ato individual de um PDF extenso, com `documento_pai_id` e páginas. Revisões editoriais marcadas `nao_evento` são excluídas desta tabela, mas permanecem rastreáveis. Apenas registros com `situacao_analise` iniciada por `confirmado por revisão editorial` foram aceitos manualmente; os demais ainda são candidatos ou correções parciais.
- `atos-identificados.ndjson`: atos individualizados e conferidos dentro de uma edição extensa. `chave_ato` identifica o ato por número estável (não só pela página); as páginas localizam a prova. É uma camada editorial, não uma extração automática de todos os atos da edição.
- `atos.csv`: fatos encontrados dentro de documentos, com decisões próprias de confirmação ou rejeição. O vínculo com fonte e página permanece para auditoria. A publicação agregada fica rejeitada como registro adicional, evitando contar novamente os mesmos fatos.
- `revisoes-eventos.ndjson`: decisões humanas por documento (`confirmar_evento`, `corrigir_categoria`, `nao_evento`), justificativa, evidência e fatos extraídos. O hash do trecho impede aplicar uma decisão antiga a texto alterado.
- `consorcios.csv`: cadastro de **identidades candidatas** com chave estável `id`, denominação, sigla, CNPJ quando o trecho o associa explicitamente ao consórcio, variações de nome e quantidade de documentos vinculados. Não é um cadastro oficial validado.
- `participacoes.csv`: uma linha por relação município–consórcio **confirmada em revisão documental**. `ano_ingresso` fica vazio se o ato não o informar; `ano_ultima_evidencia_participacao` é o ano de publicação do documento que comprova a participação, não o ano da adesão nem garantia da composição atual. Cada linha traz o documento e o link de origem.
- `vinculos-documentos.csv`: uma linha por menção explícita, ligando o `id` de `arquivo-coletas.ndjson` ao `id` do consórcio, com origem e evidência. Um documento pode mencionar mais de um consórcio. Vínculo não comprova adesão nem veracidade do evento.
- `identidades.ndjson`: registro técnico persistente das identidades e aliases; conserva a chave quando CNPJ ou variação de nome aparece depois. Divergência de CNPJ fica sem vínculo e exige revisão humana.
- `identidade-pendente.csv`: documentos potencialmente relevantes cujo trecho não sustenta um vínculo seguro; é a fila de conferência da identidade, não uma lista de consórcios inexistentes.
- `revisoes-identidades.ndjson`: exceções editoriais lacradas ao hash do trecho. Uma sigla ou nome ambíguo permanece pendente até que o documento permita identificar a entidade sem adivinhação.
- `arquivo-coletas.ndjson`: arquivo técnico de todos os documentos recuperáveis do histórico, inclusive os classificados como `GERAL`, para auditoria e futura reclassificação. Uma linha JSON por URL canônica. Atos separados não multiplicam a contagem de publicações deste arquivo.

## Como ler um evento

### Decisão por fonte alternativa

`triagem-fontes-alternativas.ndjson` guarda decisões automáticas **separadas das revisões humanas**: documento original/hash, fontes/hashes, resultado de cada leitura, modelo, prova literal, justificativa, data e vínculo de duplicata. `triagem-alternativa-uso.ndjson` controla as chamadas adicionais (até 4/passagem e 12/dia). São criados quando houver casos elegíveis.

`node scripts/triage-alternative-texts.mjs --apply` integra auxiliares já recuperados à base derivada. Sem `--apply`, pode consultar a IA, mas não grava. Só atua em primeiras coletas desde 16/10/2026 14h13min25s (Brasília), sem envio/revisão humana. Regras e IA devem concordar, com correspondência do episódio e citações literais verificadas. Falha, conflito ou falta de prova nunca viram descarte automático. Não reprocessa históricos nem libera envios.

Nas tabelas derivadas, `evidencia_triagem`, `fonte_evidencia_triagem` e `metodo_triagem` explicam o resultado automático. `trecho` continua sendo o original. Um aceito automático tem `decisao_base=confirmado`, mas não foi confirmado manualmente; veja o método. Uma duplicata/descartado não gera outra linha em `eventos.csv`, mas permanece consultável no painel e no arquivo.

`tipo_evento` é uma hipótese de classificação. `etapa` distingue projeto, autorização, ato publicado e relato. `situacao_analise` distingue candidato, revisão por IA, publicação no WhatsApp e rejeição. **Nenhum desses campos comprova sozinho que um município entrou ou saiu de um consórcio.** Por isso `efeito_na_participacao` permanece “não inferido automaticamente” até haver revisão documental específica.

`decisao_base` e `decisao_alerta` são decisões diferentes: um acontecimento pode estar **confirmado** na base e ser **histórico** para o WhatsApp. `data_fato` guarda apenas uma data exata comprovada; `mes_fato` registra mês conhecido sem inventar dia; `data_noticia_original` vem da página da fonte, não do Google. O alerta usa primeiro a data do fato, depois a data expressa no título de um ato formal, depois a data original da página e, por último, a data da coleta. A janela padrão de novidade é de sete dias. Um item do Google Notícias sem data do fato, do ato ou da página original recebe `data_nao_verificada` e não é enviado automaticamente: a data do Google pode ser só reindexação.

Cada linha mantém título, data da publicação, município/UF quando conhecidos, fonte, URL, um pequeno trecho de evidência e datas da primeira/última coleta. Campos vazios indicam informação não identificada com segurança, não ausência do fato. O arquivo técnico omite o texto integral e mascara CPF e e-mail nos trechos para não duplicar dados pessoais desnecessariamente.

Registros marcados como **“legado sem texto”** correspondem a envios antigos cujo trecho original não foi preservado. Eles permanecem na base para rastreabilidade, mas exigem abrir o documento antes de qualquer uso analítico.

## Atualização e limites da recuperação

### Recuperação complementar de fontes públicas

`scripts/recover-public-documents.mjs --apply` faz parte da rotina diária de recuperação (03h37, Brasília; agendamento de melhor esforço). Limita-se a dois registros por passagem e não importa classificadores nem WhatsApp. Sem `--apply`, não grava a base.

- **Guanhães/PortalTP:** baixa apenas PDFs do armazenamento oficial observado, até 20 MiB/80 páginas. Extrai texto por página; páginas dominadas por imagem e sem texto suficiente recebem OCR em português (até 20 páginas, com timeout). Páginas vazias/ilegíveis, limite ou falha ficam explícitos. `completo` significa que todas as páginas produziram texto, não que OCR esteja livre de erros. Não ler uma página não é motivo para descartar o documento.
- **Semana 7:** procura primeiro títulos compatíveis no acervo; reutiliza textos integrais somente com hash e URL conferidos. Se necessário, pesquisa Google Notícias e a API WordPress pública da Rede da Notícia (endereço anunciado pelo próprio portal). A comparação considera palavras específicas, números, negação e datas originais quando disponíveis. É busca de possíveis fontes, não confirmação de equivalência entre fatos. Conteúdo de snippets não é usado como corpo integral. [Contrato público da API WordPress](https://developer.wordpress.org/rest-api/reference/posts/).
- **`recuperacao-fontes-publicas.ndjson`:** auditoria por documento, tentativas, próxima tentativa com espera progressiva, páginas lidas/pendentes, hash do PDF e erros por provedor. Arquivo criado quando houver tentativa persistida.
- **`fontes-alternativas.ndjson`:** texto de outro veículo, URL própria, referência ao documento que motivou a busca, hash, leitor, proveniência da descoberta, data da leitura reaproveitada quando houver e `equivalencia_confirmada: false`. A chave é estável por documento e fonte; normal/AMP conhecidos do Araguaia Notícia não viram fontes distintas. O texto **não** é inserido em `textos-artigos.ndjson` sob o ID do Semana 7. Reproduções que citam o Semana 7 não contam como confirmação independente.
- **`textos-artigos.ndjson`:** recebe apenas a leitura integral do PDF original; preserva a primeira leitura existente e marca páginas. Nenhum novo documento, evento ou envio é criado pela recuperação. Falhas entram em espera progressiva, e sucessos não são repetidos.

Essa recuperação complementa o acervo, não elimina os bloqueios da Câmara de Guanhães ou do Semana 7. O teste de OCR usa um decreto escaneado de três páginas apenas como amostra técnica; ele não entra como achado sobre consórcios. A fonte alternativa ainda precisa ser conferida antes de sustentar uma decisão sobre o original. A leitura seletiva depende de o documento já ter sido descoberto: não é varredura integral de todos os decretos, inclusive os sem menção a consórcio na ementa.

`npm run catalog:update` acrescenta/atualiza o que está no estado atual e reaplica a decisão de novidade às linhas históricas de `eventos.csv`. `npm run catalog:backfill` também percorre as versões de `state/news-state.json` existentes no histórico Git. A carga retroativa recupera **o que foi preservado nessas versões**, não publicações que nunca foram coletadas nem o texto integral que o radar já descartou. Documentos repetidos na mesma URL são consolidados; fontes distintas sobre o mesmo fato ainda podem aparecer como linhas separadas na base para preservar a proveniência. No envio, o radar compara também o endereço original da página e a identidade do ato quando município e número da lei estão explícitos.

A base é versionada no repositório e não exige serviço externo. Revisão humana, resolução de identidade dos consórcios e confirmação da composição municipal são passos posteriores; não devem ser inferidos automaticamente apenas de uma notícia, projeto de lei ou contrato de rateio.

Quando uma edição é desdobrada em atos, a revisão antiga que tratava a URL inteira como um só evento deixa de gerar fato ou alerta; prevalecem as revisões lacradas aos trechos de cada ato. A reentrada da URL inteira na coleta é bloqueada como evento único, para não confundir uma compra com um rateio. O cadastro atual de atos é um piloto editorial: a detecção automática de limites entre atos em PDFs futuros ainda requer validação, especialmente nas páginas com múltiplos extratos.

## Identificação de consórcios (primeira etapa)

A extração automática é conservadora: aceita o nome explícito fornecido pela fonte ou uma denominação completa acompanhada de sigla no título/trecho. Valida os dígitos do CNPJ e só o associa quando aparece próximo à denominação e no contexto do próprio consórcio. Não usa correspondência aproximada nem cria entidade a partir de “consórcio intermunicipal” genérico. Menções cortadas ou sem texto ficam sem vínculo até haver documento melhor.

`id` é uma chave técnica imutável para o cadastro local; **não substitui o CNPJ**. Duas denominações só são unificadas automaticamente quando o nome normalizado ou o CNPJ validado coincidem. Siglas isoladas não bastam para unir entidades, pois podem ser ambíguas. Os resultados permanecem marcados como candidatos até conferência documental.
