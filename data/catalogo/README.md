# Base histórica do Radar Consórcios

Esta pasta guarda **documentos encontrados pelo radar**, não uma lista oficial e definitiva de consórcios ou de seus membros. Ela é atualizada nas execuções persistentes do GitHub Actions, independentemente de a notícia ser enviada ao WhatsApp.

## Por onde começar

- `resumo.md`: panorama legível, contagens por tema e links recentes para conferência.
- `eventos.csv`: visão para Excel com registros que o classificador relacionou a criação, adesão, saída, protocolo, rateio, finanças, governança, atuação, controle ou crise. **Inclui candidatos e casos posteriormente rejeitados**; filtre `situacao_analise` antes de citar um fato.
- `consorcios.csv`: nomes fornecidos explicitamente pelos metadados das fontes. É intencionalmente incompleto; não inventa nomes a partir de trechos truncados.
- `arquivo-coletas.ndjson`: arquivo técnico de todos os documentos recuperáveis do histórico, inclusive os classificados como `GERAL`, para auditoria e futura reclassificação. Uma linha JSON por URL canônica.

## Como ler um evento

`tipo_evento` é uma hipótese de classificação. `etapa` distingue projeto, autorização, ato publicado e relato. `situacao_analise` distingue candidato, revisão por IA, publicação no WhatsApp e rejeição. **Nenhum desses campos comprova sozinho que um município entrou ou saiu de um consórcio.** Por isso `efeito_na_participacao` permanece “não inferido automaticamente” até haver revisão documental específica.

Cada linha mantém título, data da publicação, município/UF quando conhecidos, fonte, URL, um pequeno trecho de evidência e datas da primeira/última coleta. Campos vazios indicam informação não identificada com segurança, não ausência do fato. O arquivo técnico omite o texto integral e mascara CPF e e-mail nos trechos para não duplicar dados pessoais desnecessariamente.

Registros marcados como **“legado sem texto”** correspondem a envios antigos cujo trecho original não foi preservado. Eles permanecem na base para rastreabilidade, mas exigem abrir o documento antes de qualquer uso analítico.

## Atualização e limites da recuperação

`npm run catalog:update` acrescenta/atualiza o que está no estado atual. `npm run catalog:backfill` também percorre as versões de `state/news-state.json` existentes no histórico Git. A carga retroativa recupera **o que foi preservado nessas versões**, não publicações que nunca foram coletadas nem o texto integral que o radar já descartou. Documentos repetidos na mesma URL são consolidados; fontes distintas sobre o mesmo fato ainda podem aparecer como linhas separadas.

A base é versionada no repositório e não exige serviço externo. Revisão humana, resolução de identidade dos consórcios e confirmação da composição municipal são passos posteriores; não devem ser inferidos automaticamente apenas de uma notícia, projeto de lei ou contrato de rateio.
