// Apply only the ten proposals explicitly approved by the user, never a general backfill.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
import { IDS, protectedSnapshot } from './pilot-retroactive-ten.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
const batch = 'piloto-retroativo-10-2026-10-16';
const directory = 'data/catalogo';
const output = 'output/retroactive-ten';
const read = async file => JSON.parse(await readFile(`${output}/${file}`, 'utf8'));
const rows = async (dir, name) => (await readFile(path.join(dir, name), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeRows = (dir, name, items) => writeFile(path.join(dir, name), items.map(JSON.stringify).join('\n') + '\n');
const metadata = [
  ['Vargem Alta: contratação por ata do CIM Noroeste, sem ingresso no consórcio', '', '', 'Vargem Alta', 'ES', 'edição de diário oficial'],
  ['Santa Inês: lei autoriza ratificação do protocolo do CONVALE', 'Consórcio Público Intermunicipal para o Desenvolvimento Regional do Vale do Piancó', 'CONVALE', 'Santa Inês', 'PB', 'lei municipal'],
  ['Indaiatuba: PL sobre ARES-PCJ encaminhado para parecer', '', '', 'Indaiatuba', 'SP', 'despacho de tramitação'],
  ['Varre-Sai ratifica aditivo do CONSPNOR e autoriza ingresso de Santa Maria Madalena', 'Consórcio Público Multifinalitário do Noroeste', 'CONSPNOR', 'Santa Maria Madalena', 'RJ', 'lei municipal'],
  ['Duplicata: Lei 1152/2026 de Varre-Sai sobre o CONSPNOR', '', '', 'Santa Maria Madalena', 'RJ', 'lei municipal'],
  ['Indaiatuba: projeto do protocolo CONECTAR aprovado e autógrafo encaminhado', 'Consórcio Nacional de Vacinas das Cidades Brasileiras', 'CONECTAR', 'Indaiatuba', 'SP', 'autógrafo de projeto de lei'],
  ['Santa Inês: ratificação de alteração e permanência no CISVAP', 'Consórcio Intermunicipal de Saúde da Região do Vale do Piancó', 'CISVAP', 'Santa Inês', 'PB', 'lei municipal'],
  ['Duplicata: arquivo rotulado 362 contém a Lei 352/2025 de Santa Inês', '', '', 'Santa Inês', 'PB', 'lei municipal'],
  ['Unaí: pauta de diligência do projeto sobre CIMINAS e AMPLA', '', '', 'Unaí', 'MG', 'pauta de comissão'],
  ['CIM Norte: assembleia autoriza cofinanciamento de viaturas do SAMU', 'Consórcio Público da Região Norte do Espírito Santo', 'CIM Norte', '', 'ES', 'ata de assembleia'],
];
const archive = await rows(directory, 'arquivo-coletas.ndjson');
const existingReviews = await rows(directory, 'revisoes-eventos.ndjson');
const applied = existingReviews.filter(r => r.lote_retroativo === batch);
if (applied.length) {
  assert.equal(applied.length, 10, 'Lote parcialmente aplicado: não repetir cegamente');
  assert.deepEqual(applied.map(r => r.documento_id.slice(0, 8)).sort(), [...IDS].sort());
  console.log('Lote já aplicado: nenhuma gravação, duplicação ou envio.');
} else {
  const snapshot = await protectedSnapshot();
  const proposals = await rows(output, 'propostas.ndjson');
  assert.deepEqual(proposals.map(r => r.id.slice(0, 8)), IDS);
  const local = await read('report.json'), ci = await read('ci-first/retroactive-ten/report.json');
  const recovered = ci.results.map(r => r.error ? local.results.find(l => l.id === r.id) : r);
  recovered[0] = await read('29164a2c-ocr.json');
  const texts = await rows(directory, 'textos-artigos.ndjson');
  const pdfRows = await rows(directory, 'recuperacao-pdf-google.ndjson');
  const evidence = await rows(directory, 'evidencias-complementares.ndjson');
  const reviews = [...existingReviews];
  const originals = [];
  for (const [index, p] of proposals.entries()) {
    const row = archive.find(r => r.id === p.id), source = recovered[index];
    assert.ok(row && source.id === p.id);
    assert.equal(hash(JSON.stringify(row)), p.original_sha256, 'Original mudou após o piloto');
    assert.ok(!row.enviado_em && !row.documento_pai_id);
    assert.ok(!existingReviews.some(r => r.documento_id === p.id), 'Não substituir outra revisão');
    assert.ok(!texts.some(r => r.documento_id === p.id), 'Não substituir leitura anterior');
    assert.ok(source.extraction.completo);
    assert.equal(source.extraction.pdf_sha256, p.pdf_sha256);
    assert.equal(hash(await readFile(`${output}/${IDS[index]}.pdf`)), p.pdf_sha256);
    const page = source.extraction.paginas.find(x => x.pagina === p.evidence.page);
    assert.ok(page.texto.replace(/\s+/g, ' ').trim().includes(p.evidence.text));
    const [title, name, acronym, municipality, uf, type] = metadata[index];
    const facts = { ano: p.year, precisao_data: 'ano', consorcio: name, sigla: acronym,
      municipio: municipality, uf, tipo_documento: type, pagina_pdf: p.evidence.page,
      limite: p.reason, ano_ingresso: '' };
    if (index === 3) Object.assign(facts, { municipio_emissor: 'Varre-Sai', lei: '1152/2026' });
    if (index === 1) facts.lei = '388/2026';
    if (index === 6) Object.assign(facts, { participacao: true, lei: '352/2025' });
    const url = `${p.recovered_url}#page=${p.evidence.page}`;
    reviews.push({ documento_id: p.id, lote_retroativo: batch,
      revisado_em: new Date().toISOString(), validacao: 'Aplicação dos dez casos autorizada pelo usuário após conferir o piloto',
      decisao: { aceito: 'confirmar_evento', descartado: 'nao_evento', duplicata: 'duplicata' }[p.decision],
      titulo: title, categoria: p.category, etapa: p.tested_rule.stage || p.reason,
      motivo: p.reason, evidencia: p.evidence.text, fonte_evidencia: url,
      fatos: facts, trecho_sha256: hash(row.trecho || ''), pdf_sha256: p.pdf_sha256,
      documento_relacionado: p.duplicate_of || '', urls_documento: [p.original_url, p.recovered_url],
      publicar: false, motivo_publicacao: 'Revisão retroativa autorizada somente para a base; não enviar em alertas nem resumo semanal.' });
    const text = redactPublicText(source.full_text);
    texts.push({ documento_id: p.id, url_original: row.url, url_artigo: p.recovered_url,
      recuperado_em: source.recovered_at, leitor: p.ocr_pages ? 'pypdf + OCR seletivo português' : 'pypdf por página',
      pdf_sha256: p.pdf_sha256, texto_sha256: hash(text), texto: text,
      paginas: source.extraction.paginas, completo: true, lote_retroativo: batch });
    const pdfIndex = pdfRows.findIndex(r => r.documento_id === p.id);
    assert.ok(pdfIndex >= 0);
    pdfRows[pdfIndex] = { ...pdfRows[pdfIndex], url_pdf: p.recovered_url,
      situacao: 'texto integral recuperado e revisão aprovada', paginas: p.pages,
      paginas_ocr_pendente: [], pdf_sha256: p.pdf_sha256, lote_retroativo: batch,
      trechos: [{ pagina: p.evidence.page, texto: p.evidence.text, leitor: page.leitor }] };
    if (p.decision === 'aceito') evidence.push({ documento_id: p.id, nome: name, sigla: acronym, cnpj: '',
      fonte_evidencia: url, evidencia: `Identidade conferida no PDF original: ${name} (${acronym}). ${p.reason}` });
    originals.push({ documento_id: p.id, original: row, proposta: p.decision, pdf_sha256: p.pdf_sha256 });
  }
  await mkdir(output, { recursive: true });
  const staged = await mkdtemp(path.join(output, 'aplicacao-'));
  await cp(directory, staged, { recursive: true });
  await writeRows(staged, 'revisoes-eventos.ndjson', reviews);
  await writeRows(staged, 'textos-artigos.ndjson', texts);
  await writeRows(staged, 'recuperacao-pdf-google.ndjson', pdfRows);
  await writeRows(staged, 'evidencias-complementares.ndjson', evidence);
  await writeFile(path.join(staged, 'lote-retroativo-10.json'), JSON.stringify({ lote: batch,
    aplicado_em: new Date().toISOString(), autorizacao: 'Usuário autorizou aplicar somente os dez casos do piloto, sem reenvios.',
    bloqueio_whatsapp: true, registros: originals }, null, 2) + '\n');
  const counts = await saveCatalog(staged, await loadCatalog(path.join(staged, 'arquivo-coletas.ndjson')));
  assert.equal(await readFile(path.join(staged, 'arquivo-coletas.ndjson'), 'utf8'), await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'));
  const eventIds = [...(await readFile(path.join(staged, 'eventos.csv'), 'utf8')).matchAll(/^"([a-f0-9]{64})",/gm)].map(m => m[1]);
  assert.equal(new Set(eventIds).size, eventIds.length);
  for (const p of proposals) assert.equal(eventIds.includes(p.id), p.decision === 'aceito', p.label);
  const oldIds = [...(await readFile(path.join(directory, 'eventos.csv'), 'utf8')).matchAll(/^"([a-f0-9]{64})",/gm)].map(m => m[1]);
  assert.ok(oldIds.every(id => eventIds.includes(id)), 'Não remover fatos fora do lote');
  assert.equal(eventIds.length, oldIds.length + 5);
  assert.deepEqual(await protectedSnapshot(), snapshot, 'Produção mudou durante preparação');
  if (process.argv.includes('--apply')) {
    for (const name of await readdir(staged)) {
      const next = await readFile(path.join(staged, name));
      const previous = await readFile(path.join(directory, name)).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
      if (!previous || !previous.equals(next)) await writeFile(path.join(directory, name), next);
    }
  }
  console.log(JSON.stringify({ applied: process.argv.includes('--apply'), staged, ...counts,
    addedFacts: 5, discarded: 3, duplicates: 2, originalArchiveUnchanged: true, whatsappCalls: 0 }, null, 2));
}
