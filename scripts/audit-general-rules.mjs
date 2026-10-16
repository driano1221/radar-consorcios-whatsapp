// Read-only replay: originals, complete readings and alternatives remain separate.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { classifyItem } from '../src/lib/classifier.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
const rows = async name => (await readFile(`data/catalogo/${name}.ndjson`, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const before = await protectedSnapshot();
const archive = await rows('arquivo-coletas'), texts = await rows('textos-artigos');
const alternatives = await rows('fontes-alternativas'), reviews = await rows('revisoes-eventos');
const byText = new Map(texts.map(t => [t.documento_id, t]));
const byReview = new Map(reviews.map(r => [r.documento_id, r]));
const results = [];
for (const r of archive) {
  const t = byText.get(r.id), review = byReview.get(r.id);
  const inputs = [{ origin: t ? 'original_fulltext' : 'original_fragment',
    text: t?.texto || r.trecho || '', url: t?.url_artigo || r.article_url || r.url, title: r.titulo }];
  for (const s of alternatives.filter(s => s.documento_id === r.id))
    inputs.push({ origin: `alternative:${s.id}`, text: s.texto, url: s.url_fonte, title: s.titulo_fonte });
  for (const input of inputs) {
    const c = classifyItem({ kind: r.tipo_fonte === 'gazette' ? 'gazette' : 'news',
      title: input.title, rawText: input.text, summary: input.text, url: r.url,
      articleUrl: input.url, source: r.fonte, publishedAt: r.data_publicacao });
    results.push({ id: r.id, origin: input.origin, title: input.title, url: input.url,
      chars: input.text.length, reviewed: Boolean(review), expected: review?.categoria || review?.decisao || '',
      category: c.category, accepted: c.category !== 'GERAL' && c.score >= 5,
      proofKind: c.proofKind || '', stage: c.stage || '', evidence: c.evidenceText || '',
      members: c.compositionMunicipalities || [] });
  }
}
const mode = process.argv.includes('--baseline') ? 'before' : 'after';
await mkdir('output/general-rules', { recursive: true });
await writeFile(`output/general-rules/${mode}.json`, JSON.stringify(results, null, 2));
if (JSON.stringify(before) !== JSON.stringify(await protectedSnapshot())) throw new Error('Protected files changed');
console.log(JSON.stringify({ mode, publications: archive.length, readings: results.length,
  fulltext: texts.length, accepted: results.filter(r => r.accepted).length, protectedFilesUnchanged: true }));
if (mode === 'after') {
  const prior = JSON.parse(await readFile('output/general-rules/before.json', 'utf8'));
  const changes = results.flatMap((r, i) => {
    const p = prior[i];
    if (p.id !== r.id || p.origin !== r.origin) throw new Error('Corpus changed');
    return p.category !== r.category || p.accepted !== r.accepted || p.proofKind !== r.proofKind
      ? [{ ...r, before: p.category, acceptedBefore: p.accepted }] : [];
  });
  await writeFile('output/general-rules/changes.json', JSON.stringify(changes, null, 2));
  console.log(JSON.stringify({ changedReadings: changes.length, changes: changes.map(r => ({ id:r.id.slice(0,8),
    title:r.title, before:r.before, after:r.category, reviewed:r.reviewed, origin:r.origin })) }, null, 2));
}
