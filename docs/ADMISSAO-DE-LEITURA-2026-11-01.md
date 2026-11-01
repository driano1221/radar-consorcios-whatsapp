# Leitura obrigatória antes da triagem

## Resultado dos cinco originais

Estudo real, sem credenciais de WhatsApp/IA, no GitHub: [41337003818](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41337003818). O artefato `public-recovery-validation` contém `pending-access-study.json` e `pending-access-readings.json`. Foram nove rotas públicas verificadas, nenhuma escrita no acervo durante o estudo, nenhuma mensagem e nenhuma chamada de IA.

| Caso | Leitura real | Conclusão |
| --- | --- | --- |
| Repórter Diário / El Niño no ABC | Artigo e API pública do mesmo jornal retornaram 403 | Barrada na entrada; conteúdo não julgado |
| Itanhaém / Lei 4.696/2023 | Endereço legislativo retornou 400; PDF oficial da Prefeitura retornou 200, 20 páginas completas | Lei exata delimitada na página 10; ato de 2023, rejeitado como notícia nova |
| Midiamax / Consórcio Central | Artigo e API pública do mesmo jornal retornaram 403 | Barrada na entrada; conteúdo não julgado |
| CNM / Defesa Civil em Gramado | Portal e domínio público `api.cnm.org.br` retornaram 403 no executor GitHub | Barrada na entrada; conteúdo não julgado |
| Lagoa Vermelha / PL 0076/2026 | HTTP 200 com desafio antibot, sem texto do projeto | Barrada na entrada; conteúdo não julgado |

O PDF alternativo de Itanhaém é https://www2.itanhaem.sp.gov.br/wp-content/uploads/2023/10/829.pdf. A lei é de 18/10/2023; o boletim abrange 20 a 24/10/2023. Não se atribuiu um dia exato de publicação que a fonte não comprova. A antiga data de indexação ficou em `data_indexacao`, separada da data do ato. A leitura integral das 20 páginas, com dados pessoais óbvios omitidos, está em `data/catalogo/leituras-boletins/itanhaem-829-2023.json`; o texto canônico contém somente a lei correspondente, não os demais atos do boletim. O seletor exige número, ano, município, promulgação, artigos e término explícito. Ausência, duplicidade e recorte incompleto falham de forma explícita.

## Causa e correção do fluxo

O recuo de 2 a 24 horas limitava a frequência, mas não o número de tentativas. Por isso as mesmas entradas sem texto continuavam em processamento indefinidamente.

`reading-admission.mjs` impõe um limite de três tentativas reais para falhas persistentes de acesso em triagem pendente: 400/401/403/404/410 e antibot. URL inválida ou resposta não HTML sem leitor aplicável são barradas na primeira falha registrada, pois o leitor HTML já as retira da seleção e não faria a segunda tentativa prometida. `destino_pdf` segue para o leitor PDF e não entra nesse bloqueio. Não trata timeout transitório como bloqueio permanente nem bane PDF/HTML como categorias de formato. PDF legível continua admitido, inclusive com OCR e delimitação da unidade legal.

A decisão resultante aparece em Rejeitadas com a etapa **Barrada na entrada — íntegra indisponível** e base `admissibilidade`. Seu diagnóstico possui hash próprio; a prova de conteúdo fica vazia, pois não houve leitura. Ela não deve ser apresentada como inexistência do evento. A validação distingue essa decisão de uma rejeição por conteúdo e não permite que uma rejeição comum use diagnóstico como citação literal.

O caso barrado deixa a seleção automática de recuperação. Não há próxima tentativa automática prometida. Uma nova íntegra válida pode entrar pelo reprocessamento compartilhado e receber decisão documental; nenhuma revisão humana pode ser substituída por esse mecanismo. Casos transitórios ou recém-descobertos ainda podem ficar pendentes dentro do orçamento, com motivo e próxima tentativa. Assim, a política encerra o acesso persistentemente bloqueado sem fabricar interpretação de um texto ausente.

## Aplicação reproduzível e proteção

`node scripts/conclude-access-study.mjs --study-dir=<artefato>/public-recovery` mostra o plano. `--apply` exige que os cinco ainda estejam pendentes e que as tentativas do acervo coincidam com o baseline do estudo; uma decisão posterior impede a aplicação. Foram preservados byte a byte os arquivos operacionais, revisões humanas e manifestos históricos. Todos os textos anteriores e todas as linhas do arquivo de notícias fora dos cinco foram conferidos sem diferenças. Os cinco continuam com `alertAllowed=false` e `weeklyAllowed=false`.

O sexto bloqueio, CISAMAPI, surgiu depois do lote original. Ele não foi transformado em rejeição por associação: tinha uma tentativa, portanto permanece sujeito ao mesmo orçamento e à próxima janela, sem exceção por ID.

## Resumo aprovado

O resumo semanal aprovado foi enviado ao **Radar Consórcios - Teste**, conforme confirmação do usuário, que fará o encaminhamento aos chefes. [Execução 41336724038](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41336724038): uma mensagem, 22 publicações, recibo `2026-11-01T18:28:45.394Z` (15h28 de Brasília), persistido em `ead4aa9`. A sessão conferiu o nome real do grupo antes de enviar. A primeira tentativa parou nos testes antes da conexão; o vazamento de variáveis da edição aprovada para a fixture foi corrigido no ambiente isolado de testes. A entrega aprovada não usou IA, coleta nem encurtador. Não reexecutar para testar: o recibo já comprova o registro pelo bot, não a leitura pelos participantes.
