# Aplicação controlada dos dez históricos — 16/10/2026

O usuário aprovou aplicar apenas o lote do [piloto](PILOTO-RETROATIVO-10-2026-10-16.md), atualizar o painel e contar o restante antes de ampliar. Nenhum outro documento foi reclassificado nesta rodada.

## Resultado aplicado

| Medida | Antes | Depois |
|---|---:|---:|
| Publicações originais no arquivo | 1.946 | 1.946 |
| Fatos confirmados exibidos no painel | 105 | 110 |
| Documentos do lote com texto integral guardado | 0 | 10 |
| Decisões do lote | Sem revisão humana | 5 aceites, 3 descartes, 2 duplicatas |
| Envios WhatsApp causados pela aplicação | 0 | 0 |

Os sete atos individualizados existentes continuam preservados. `eventos.csv` tem 111 linhas: 110 confirmadas e uma linha histórica rejeitada já existente; não confundir total de linhas com fatos confirmados. Quatro identidades documentais foram adicionadas e uma (CISVAP) reutilizada, chegando a 70 identidades, não 70 CNPJs validados.

O arquivo bruto e o estado do WhatsApp não foram reescritos. `lote-retroativo-10.json` preserva os dez registros originais para auditoria. Revisões ficam lacradas ao hash do trecho original; PDFs têm SHA-256, páginas e texto integral separados. A interface mostra título de consulta, ano comprovado, justificativa e fonte com página, conservando o título e link de origem. O painel público oferece trechos e links, não republica integralmente os PDFs.

Exemplo: Santa Inês/CISVAP agora comprova permanência em **2025**; o ano de ingresso permanece vazio. A data de indexação em 2026 não virou data do fato. A lei de Varre-Sai identifica Varre-Sai como emissor e Santa Maria Madalena como município cujo ingresso foi autorizado.

## Proteção contra reenvio e repetição

- Os dez têm `publicar: false`; os cinco aceitos ficam como históricos, não alertas.
- URLs originais do Google e links diretos conferidos dos PDFs passam pelo bloqueio editorial, no diário e no semanal.
- A aplicação repetida não grava nada. Não exige os arquivos temporários do piloto quando o lote completo já está aplicado.
- 383 testes Node passaram, incluindo prova literal por página, imutabilidade dos originais, cinco fatos únicos e simulação de coleta atual dos links sem alerta nem destaque semanal.
- Workflow `test-historical-batch.yml` valida a versão aplicada sem secrets, sem coletas e sem código de envio. O `--apply` nesse workflow só verifica o lote já aplicado e retorna sem gravar.
- O problema de HTTP 403 de Vargem Alta no Actions **não foi resolvido**: este documento foi recuperado localmente no piloto. Não confundir sucesso da revisão com garantia de acesso futuro.

## Restante inventariado, ainda não revisado

Inventário reproduzível: `node scripts/inventory-retroactive-backlog.mjs`. Critério: sem revisão humana e sem texto integral guardado, com título insuficiente, descarte explícito por falta de texto ou tentativa de recuperação não concluída. São **13 registros/URLs**, não 13 episódios distintos nem 13 novos fatos confirmados.

| Grupo | Quantidade |
|---|---:|
| Remanescente do grupo original com título insuficiente | 1 |
| Descarte explícito por falta de texto | 2 |
| Outras recuperações sem texto integral | 10 |
| Total sem sobreposição | 13 |

| ID inicial | Documento | Lacuna registrada |
|---|---|---|
| afae42c5 | Despacho de Indaiatuba / ARES-PCJ | Fragmento PDF com codificação ruim; outra URL a confrontar com o piloto |
| c415a567 | Curitiba e Pinhais no evento Progov | Descarte por falta de texto |
| cc60e177 | Seminário Progov na Fiep | Descarte por falta de texto |
| 1bb8aa8d | Consórcio ABC/Metodista — Repórter Diário | HTTP 403 |
| 68160372 | Consórcio ABC/Metodista — Opinião Pública | Codificação `iso-utf-8` inválida |
| a22322a6 | Consórcio ABC/Metodista — ABCD Jornal | Bloqueio de acesso |
| 74fb6772 | Municípios de SC e Conclima — CNM | HTTP 403 |
| b940d094 | Visita técnica do Consórcio ABC à GCM | Bloqueio de acesso |
| f46c947c | Consórcio ABC/Braskem e polo petroquímico | Bloqueio de acesso |
| 0c2c9c6b | Processo seletivo Amurc | HTTP 403; título indica recrutamento fora do escopo |
| cfbb82ef | Tratativas de plano climático do ABC | Falha de conexão; decisão atual indica agenda sem deliberação |
| e41368d4 | Convocação de assembleia CIMCERO | Texto não recuperado; convocação não comprova realização |
| e64cf89d | Empréstimo dos Correios e consórcio de bancos | Bloqueio; título indica consórcio bancário, não público intermunicipal |

Sugestão para eventual próximo lote: priorizar os nove primeiros; os quatro últimos têm sinais de descarte temático. As três notícias de bolsas podem tratar do mesmo episódio e exigem confronto, não três aceites automáticos. Nenhuma dessas decisões foi aplicada.

Limite do inventário: ausência de íntegra, por si só, não obriga revisão de todo o acervo. Muitos registros têm excerto suficiente ou estão claramente fora do escopo. A contagem de 13 cobre lacunas explicitamente detectáveis, **não prova que todos os demais descartes estejam corretos**. O painel marcar zero candidatos significa ausência de pendência formal atual, não auditoria integral concluída.
