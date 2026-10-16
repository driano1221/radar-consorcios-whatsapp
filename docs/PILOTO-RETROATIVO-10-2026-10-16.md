# Piloto retroativo de dez registros — 16/10/2026

Status: validado em ambiente isolado; **não aplicado à base nem ao restante do acervo**. Branch `fix/amm-triage-recovery`.

## Resultado

Antes, os dez registros estavam em GERAL / sem evento relevante comprovado, com título genérico ou fragmentos de PDF. A seleção está congelada em `scripts/pilot-retroactive-ten.mjs`: dez casos sem revisão humana e sem envio, entre os onze títulos insuficientes. Ficou de fora outra URL do despacho de Indaiatuba; foram mantidos dois pares de duplicatas para testar a proteção.

| Registro | Proposta após recuperar o documento | Ano real | Prova |
|---|---|---|---|
| Vargem Alta / CIM Noroeste | Descartar: contrato de fornecedor por adesão à ata, não ingresso no consórcio | 2026 | PDF pp. 8–9; menção genérica p. 2 |
| Santa Inês / CONVALE | Aceitar PROTOCOLO: Lei 388/2026 de autorização/ratificação; não afirmar operação iniciada | 2026 | PDF pp. 1–2 |
| Indaiatuba / ARES-PCJ | Descartar: despacho para parecer do PL 74/2024, não aprovação | 2024 | PDF p. 1 |
| Varre-Sai / CONSPNOR | Aceitar ADESÃO AUTORIZADA: lei de Varre-Sai autoriza Santa Maria Madalena a integrar o consórcio | 2026 | Lei 1152, PDF p. 1 |
| Segunda URL de Varre-Sai | Duplicata byte a byte da anterior, não segundo fato | 2026 | SHA-256 idêntico |
| Indaiatuba / CONECTAR | Aceitar PROTOCOLO: projeto aprovado e autógrafo encaminhado; não sanção/constituição comprovadas | 2021 | PDF pp. 2–4 |
| Santa Inês / CISVAP | Aceitar GOVERNANÇA: alteração e permanência; ano de ingresso original continua desconhecido | 2025 | Lei 352, PDF pp. 1–2 |
| Arquivo Santa Inês com “362” no endereço | Duplicata da Lei 352/2025; conteúdo e hash prevalecem sobre nome do arquivo | 2025 | SHA-256 idêntico |
| Unaí / CIMINAS e AMPLA | Descartar: pauta/diligência de emendas do PL 51/2025, sem decisão de ingresso | 2025 | PDF p. 1, item 06 |
| CIM Norte / SAMU | Aceitar FINANÇAS: assembleia autoriza cofinanciamento; não afirmar pagamento ou aditivo assinado | 2021 | Ata 04/2021, PDF pp. 2–3 |

Total proposto: **5 aceites únicos, 3 descartes e 2 duplicatas**. Dez arquivos recuperados; 62 ocorrências de páginas, 56 páginas únicas; 11 páginas com OCR. O protocolo citado como anexo da Lei 352 não está reproduzido integralmente: recuperar o arquivo inteiro não significa recuperar anexos ausentes.

## Defeitos revelados e ajustes na branch de teste

- Nome Varre-Sai confundido com verbo “sai”: corrigido o reconhecimento de saída.
- Lei autorizativa e autógrafo com minuta promovidos a constituição consumada: etapas diferenciadas.
- Permanência confundida com rateio: classificação de governança com vínculo existente, sem inventar data de ingresso.
- Deliberação de cofinanciamento perdida: regra exige ata e aprovação expressa, não simples proposta.
- Cabeçalho nativo ocultava corpo escaneado: detectar texto dentro da imagem dominante, não só contar caracteres da página inteira.
- Fonte nativa de Unaí tem codificação quebrada: OCR seletivo explicitamente solicitado para a página 1 do piloto.

## Segurança e reprodução

`node scripts/pilot-retroactive-ten.mjs` só escreve em `output/retroactive-ten/`, recusa `--apply`, protege todos os arquivos de `data/` e `state/` por hash e não importa código de envio. `--cached` relê cópias já baixadas. Preserva o endereço original do Google separado do PDF efetivamente lido, hash do documento e páginas.

Workflow existente `test-public-recovery.yml`, entrada `retroactive_ten=true`, na branch de teste. Não recebe secrets do WhatsApp e tem apenas `contents: read`.

Primeira execução: https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38942951375 . Recuperou nove dos dez PDFs no Actions; **Vargem Alta respondeu HTTP 403 no Actions**, mas HTTP 200 localmente. Não afirmar que o acesso contínuo dessa fonte está resolvido. OCR de suas dez páginas escaneadas foi feito localmente com Tesseract.js em ambiente temporário; Unaí recebeu OCR no Actions.

`scripts/report-retroactive-ten.mjs` combina o artefato extraído em `output/retroactive-ten/ci-first/` e a leitura local com OCR, verifica página/trecho, testa as regras contra as decisões conferidas e produz `ANTES-DEPOIS.md`, `comparacao.json` e `propostas.ndjson`. A projeção é em memória; repetir gera os mesmos dez IDs e cinco fatos, todos inelegíveis para notificação. **Não é ainda a migração do catálogo de produção.**

380 testes Node e três testes Python passaram localmente. 25 arquivos protegidos permaneceram idênticos. Nenhuma chamada à API de IA neste piloto: regras e conferência documental/visual do assistente. A revisão DeepSeek de produção não foi modificada. Tampouco se alterou o corte temporal da triagem automática de fontes alternativas.

## Limites e próximo passo

O usuário pediu o antes/depois antes de expandir. Mostrar o relatório, confirmar a proposta e só então planejar aplicação controlada desses dez e expansão. A futura aplicação deve atualizar o mesmo ID, preservar decisão anterior/evidência e bloquear tanto alerta diário quanto resumo semanal para históricos. Não converter as propostas deste piloto em revisões humanas já aprovadas.

Neste lote, recuperaram-se os **PDFs originais**, não fontes jornalísticas alternativas. O piloto não mede a precisão geral da correspondência entre notícias de sites diferentes e não comprova triagem perfeita de todo o acervo.
