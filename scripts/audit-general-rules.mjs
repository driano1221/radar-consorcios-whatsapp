// Read-only replay: originals, complete readings and alternatives remain separate.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { classifyItem } from '../src/lib/classifier.mjs';
import { execFileSync } from 'node:child_process';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
const rows = async name => (await readFile(`data/catalogo/${name}.ndjson`, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const before = await protectedSnapshot();
const baselineRef = process.argv[process.argv.indexOf('--baseline-ref') + 1];
let classify = classifyItem;
const historical = process.argv.includes('--baseline-ref');
if (historical) {
  if (!/^[a-f0-9]{7,40}$/.test(baselineRef || '')) throw new Error('Expected a commit hash for baseline');
  const source = file => execFileSync('git', ['show', `${baselineRef}:src/lib/${file}`], { encoding:'utf8' });
  const inline = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
  const imports = code => code.replace(/from '\.\/(.*?)'/g, (_,file) => `from '${new URL('../src/lib/'+file, import.meta.url).href}'`);
  // These two modules contain the changed rules. Shared text/contract helpers
  // must be unchanged; otherwise refuse a misleading historical comparison.
  for (const file of ['text.mjs','contract-context.mjs'])
    if (source(file).replace(/\r\n/g,'\n') !== (await readFile(new URL('../src/lib/'+file,import.meta.url),'utf8')).replace(/\r\n/g,'\n'))
      throw new Error(`Baseline dependency changed: ${file}`);
  const proof=inline(imports(source('event-proof.mjs')));
  classify=(await import(inline(imports(source('classifier.mjs').replace("from './event-proof.mjs'",`from '${proof}'`))))).classifyItem;
}
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
    const c = classify({ kind: r.tipo_fonte === 'gazette' ? 'gazette' : 'news',
      title: input.title, rawText: input.text, summary: input.text, url: r.url,
      articleUrl: input.url, source: r.fonte, publishedAt: r.data_publicacao });
    results.push({ id: r.id, origin: input.origin, title: input.title, url: input.url,
      chars: input.text.length, reviewed: Boolean(review), expected: review?.categoria || review?.decisao || '',
      category: c.category, accepted: c.category !== 'GERAL' && c.score >= 5,
      proofKind: c.proofKind || '', stage: c.stage || '', evidence: c.evidenceText || '',
      members: c.compositionMunicipalities || [] });
  }
}
const mode = process.argv.includes('--baseline') || historical ? 'before' : 'after';
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
