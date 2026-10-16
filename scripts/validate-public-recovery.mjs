// Live read-only test, separate from the archive and from WhatsApp credentials.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { downloadGuanhaesPdf, readGuanhaesPdf, findAlternativeTexts, searchAlternatives,
  compareAlternative } from '../src/lib/public-document-recovery.mjs';
import { recoverPublicDocuments } from './recover-public-documents.mjs';

await mkdir('output/public-recovery', { recursive: true });
const archive = (await readFile('data/catalogo/arquivo-coletas.ndjson', 'utf8')).trim().split('\n').map(JSON.parse);
const original = archive.find(row => row.id.startsWith('0783e43a'));
assert.ok(original, 'Caso real de referência ausente');
const url = 'https://s3.amazonaws.com/el.com.br/portal/uploads/3177/arquivos/A31B91791FFD4A8D976910AE16B155A0.pdf';
await writeFile('output/public-recovery/guanhaes.pdf', await downloadGuanhaesPdf(url));
const pdf = await readGuanhaesPdf(url);
await writeFile('output/public-recovery/pdf-reading.json', JSON.stringify(pdf, null, 2));
assert.equal(pdf.completo, true, 'PDF real não foi integralmente lido');
assert.equal(pdf.paginas.length, 3);
assert.equal(pdf.ocr_paginas, 3, 'As três páginas reais são escaneadas');
assert.ok(pdf.paginas.every(page => page.texto.length >= 80));
assert.match(pdf.paginas[0].texto, /FUNDEB/i);
assert.match(pdf.paginas[0].texto, /5[.,]?245/);
// This FUNDEB decree is a technical access/OCR sample, NOT a consortium finding.
const alternate = await findAlternativeTexts(original, archive, { searchEvenWithArchive: true });
await writeFile('output/public-recovery/alternative-reading.json', JSON.stringify(alternate, null, 2));
assert.equal(alternate.searchStatus, 'ok', 'Busca web falhou');
assert.ok(alternate.alternatives.some(a => a.url_fonte.includes('araguaianoticia.com.br/noticia/79550/')),
  'Fonte alternativa real não recuperada');
assert.equal(new Set(alternate.alternatives.map(a => a.id)).size, alternate.alternatives.length);
assert.ok(alternate.alternatives.every(a => !a.equivalencia_confirmada));
// Exercise external discovery without using the archive candidate as a shortcut.
const external = await findAlternativeTexts(original, [], { searchEvenWithArchive: true, maxReads: 2 });
await writeFile('output/public-recovery/external-reading.json', JSON.stringify(external, null, 2));
assert.equal(external.searchStatus, 'ok');
assert.ok(external.alternatives.length, 'Busca externa não encontrou um texto legível compatível');
const report = { pdf: { pages: pdf.paginas.length, ocrPages: pdf.ocr_paginas, complete: pdf.completo,
  characters: pdf.paginas.map(p => p.texto.length), pdfSha256: pdf.pdf_sha256 },
  archiveAndWeb: { search: alternate.searchStatus, results: alternate.searchCount,
    alternatives: alternate.alternatives.map(a => ({ url: a.url_fonte, characters: a.texto.length,
      independent: a.independencia, equivalenceConfirmed: a.equivalencia_confirmada })) },
  externalOnly: { search: external.searchStatus, results: external.searchCount,
    alternatives: external.alternatives.map(a => ({ url: a.url_fonte, characters: a.texto.length })) } };
console.log(JSON.stringify(report));
await writeFile('output/public-recovery/report.json', JSON.stringify(report, null, 2));
// No --apply: real catalog decisions/IDs/send state cannot be modified here.
await recoverPublicDocuments({ apply: false });
