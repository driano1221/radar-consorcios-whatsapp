// Curated pilot expectations, not production overrides. No production writes.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { classifyItem } from '../src/lib/classifier.mjs';
import { protectedSnapshot, duplicateOwner } from './pilot-retroactive-ten.mjs';

const directory = 'output/retroactive-ten';
const read = async file => JSON.parse(await readFile(`${directory}/${file}`, 'utf8'));
const before = await protectedSnapshot();
const local = await read('report.json');
const ci = await read('ci-first/retroactive-ten/report.json');
const rows = ci.results.map(r => r.error ? local.results.find(l => l.id === r.id) : r);
rows[0] = await read('29164a2c-ocr.json');
const normalize = s => s.replace(/\s+/g, ' ').trim();

// Based on full PDFs plus visual inspection; user has not approved application.
const expected = [
  ['Vargem Alta / CIM Noroeste', 'descartado', 'GERAL', 2026, 9, 'CONTRATADO: INNOVA',
    'Contrato rotineiro com fornecedor por adesão a uma ata de preços, não ingresso no consórcio. A menção genérica na p. 2 e o plano cultural das pp. 11–20 também não comprovam evento consorcial.'],
  ['Santa Inês / CONVALE', 'aceito', 'PROTOCOLO', 2026, 1, 'AUTORIZA O PODER EXECUTIVO',
    'Lei 388/2026 autoriza ratificação do protocolo; a p. 2 menciona sua conversão em contrato. Registrar a etapa legal, sem afirmar constituição operacional consumada.'],
  ['Indaiatuba / ARES-PCJ', 'descartado', 'GERAL', 2024, 1, 'Aguardando Parecer Jurídico',
    'Despacho encaminha o PL 74/2024 para parecer. Não comprova aprovação ou ratificação.'],
  ['Varre-Sai / CONSPNOR', 'aceito', 'ADESÃO AUTORIZADA', 2026, 1, 'Parágrafo Único',
    'Lei 1152/2026 de Varre-Sai ratifica contrato/aditivos e autoriza Santa Maria Madalena a integrar o CONSPNOR. Município emissor e município beneficiário são distintos; não registrar saída nem nova adesão de Varre-Sai.'],
  ['Varre-Sai / segunda URL', 'duplicata', 'ADESÃO AUTORIZADA', 2026, 1, 'LEI Nº 1152/2026',
    'Mesmo PDF da linha anterior, byte a byte; muda apenas o parâmetro de calendário da URL. Vincular a fonte, sem criar outro fato.'],
  ['Indaiatuba / CONECTAR', 'aceito', 'PROTOCOLO', 2021, 2, 'Encaminho, para os devidos fins',
    'Autógrafo 17/2021 do PL 31/2021 comprova aprovação em plenário. Não confundir a minuta com lei sancionada ou a constituição consumada do consórcio.'],
  ['Santa Inês / CISVAP', 'aceito', 'GOVERNANÇA', 2025, 2, 'Art. 3°.',
    'Lei 352/2025 ratifica alteração e autoriza permanência. Comprova vínculo já existente, não ano de ingresso nem novo contrato de rateio. O anexo do protocolo é apenas identificado na p. 3, não reproduzido integralmente.'],
  ['Santa Inês / arquivo rotulado 362', 'duplicata', 'GOVERNANÇA', 2025, 1, '352/2025',
    'O endereço tem 362, mas o arquivo é idêntico ao PDF da Lei 352/2025. Usar o conteúdo, não inventar uma segunda lei pelo nome do arquivo.'],
  ['Unaí / CIMINAS e AMPLA', 'descartado', 'GERAL', 2025, 1, 'CONVERSÃO EM DILIGÊNCIA',
    'Pauta da comissão: encaminhamento de emendas do PL 51/2025. Não comprova aprovação do projeto ou ingresso. OCR corrigiu a codificação nativa ilegível.'],
  ['CIM Norte / SAMU', 'aceito', 'FINANÇAS', 2021, 2, 'foi aprovado por unanimidade',
    'Ata 04/2021 autoriza cofinanciamento municipal de 40% da locação de viaturas e aprova alterações de comissão/cronograma. Não comprova pagamento ou assinatura posterior de aditivo. Ano 2021, não 2026 do endereço de upload.'],
];
const proposals = [];
for (const [index, row] of rows.entries()) {
  const [label, decision, category, year, page, needle, reason] = expected[index];
  assert.ok(row.extraction?.completo, `Leitura incompleta ${label}`);
  const pageText = normalize(row.extraction.paginas.find(p => p.pagina === page)?.texto || '');
  const at = pageText.toLocaleLowerCase('pt-BR').indexOf(needle.toLocaleLowerCase('pt-BR'));
  assert.ok(at >= 0, `Trecho não encontrado ${label}`);
  const rule = classifyItem({ kind: 'news', title: row.before.title, rawText: row.full_text, url: row.recovered_url });
  assert.equal(rule.category, category, `Regra diverge da conferência ${label}`);
  const duplicate = duplicateOwner(rows.slice(0, index), row);
  assert.equal(Boolean(duplicate), decision === 'duplicata');
  proposals.push({ id: row.id, label, decision, category, year, reason,
    reviewed_by: 'assistente; conferência documental e visual; aplicação aguarda validação do usuário',
    original_sha256: row.original_sha256, pdf_sha256: row.extraction.pdf_sha256,
    original_url: row.original_url, recovered_url: row.recovered_url, source_kind: 'original_pdf',
    duplicate_of: duplicate, before: row.before, first_full_text_rule: local.results[index].rule_after,
    tested_rule: rule, evidence: { page, text: pageText.slice(at, at + 500) },
    pages: row.extraction.paginas.length, chars: row.full_text.length,
    ocr_pages: row.extraction.ocr_paginas, notification_eligible: false });
}

// Simulation is in memory, keyed by the existing document ID. Repeat cannot add
// documents, facts or WhatsApp eligibility. This is not the production catalog.
function project(previous, decisions) {
  const copy = new Map(previous);
  for (const r of decisions) copy.set(r.id, { decision: r.decision, category: r.category,
    duplicate_of: r.duplicate_of, notification_eligible: false });
  return copy;
}
const once = project(new Map(), proposals), twice = project(once, proposals);
assert.deepEqual([...once], [...twice]);
assert.equal(once.size, 10);
assert.equal([...once.values()].filter(r => r.decision === 'aceito').length, 5);
assert.ok([...once.values()].every(r => r.notification_eligible === false));
assert.deepEqual(await protectedSnapshot(), before);
await writeFile(`${directory}/propostas.ndjson`, proposals.map(JSON.stringify).join('\n') + '\n');
const report = {
  production_applied: false, protected_files_unchanged: Object.keys(before).length,
  selected: 10, recovered: 10, accepted_proposed: 5, discarded_proposed: 3, duplicates: 2,
  page_occurrences: proposals.reduce((sum, p) => sum + p.pages, 0),
  ocr_page_occurrences: proposals.reduce((sum, p) => sum + p.ocr_pages, 0),
  calls_to_whatsapp: 0, calls_to_llm_api: 0, replay_identical: true,
  ci_original_recovered: 9, ci_original_blocked: ['29164a2c: HTTP 403; recovered locally'],
  proposals,
};
await writeFile(`${directory}/comparacao.json`, JSON.stringify(report, null, 2));
let md = '# Piloto retroativo: 10 registros antigos\n\n';
md += 'Resultado de teste, NÃO aplicado à base. Antes: os dez estavam em GERAL / sem evento relevante comprovado, com título ou fragmentos insuficientes. Depois proposto: 5 aceites, 3 descartes fundamentados e 2 duplicatas.\n\n';
md += 'Foram recuperadas as próprias fontes em PDF, não notícias de terceiros. O endereço original do Google continua preservado separadamente. Leitura das 62 ocorrências de páginas (56 páginas únicas), incluindo 11 páginas com OCR. Leitura completa do arquivo disponível não garante que todos os anexos citados estejam incluídos nele.\n\n';
md += '| Caso | Antes | Depois proposto | Ano do documento | Prova |\n|---|---|---|---|---|\n';
for (const [i, p] of proposals.entries()) md += `| ${i + 1}. ${p.label} | Fora / GERAL | ${p.decision}: ${p.category} | ${p.year} | [PDF, p. ${p.evidence.page}](${p.recovered_url}) |\n`;
for (const [i, p] of proposals.entries()) md += `\n## ${i + 1}. ${p.label}\n\n${p.reason}\n\nPágina ${p.evidence.page}, trecho extraído (espaçamento normalizado):\n\n> ${p.evidence.text}\n\nID: \`${p.id}\`. SHA-256 PDF: \`${p.pdf_sha256}\`.\n\n[Documento recuperado](${p.recovered_url}) · [Registro original](${p.original_url})\n`;
md += '\n## Segurança e limitações\n\n- Nenhuma gravação em data/ ou state/: 25 arquivos protegidos comparados por hash.\n- Nenhum envio ao WhatsApp, nem diário nem semanal; o workflow não recebe credenciais de WhatsApp.\n- Repetição da projeção isolada produziu os mesmos 10 registros e 5 fatos únicos. Não é ainda migração aplicada ao catálogo de produção.\n- Nenhuma chamada à API de IA neste piloto: classificação por regras, conferência do assistente e inspeção visual das evidências. A revisão DeepSeek de produção continua inalterada.\n- GitHub Actions recuperou 9/10; Vargem Alta deu HTTP 403, embora o PDF original abrisse localmente. Seu OCR foi concluído localmente. Não declarar acesso automático dessa fonte resolvido.\n- Datas de coleta/indexação não substituem o ano do ato. CNPJ municipal do rodapé não foi atribuído ao consórcio.\n- Regras de teste e relatório estão em branch separada; main, painel público e base histórica permanecem sem esta aplicação.\n- O piloto não valida genericamente a busca de fontes alternativas para todo o acervo: estes dez são PDFs originais recuperados.\n';
await writeFile(`${directory}/ANTES-DEPOIS.md`, md);
console.log(JSON.stringify({ ...report, proposals: undefined }, null, 2));
