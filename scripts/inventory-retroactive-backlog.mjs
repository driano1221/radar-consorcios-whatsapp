// Read-only inventory: no downloads, classifications, catalog writes or sending.
import { readFile } from 'node:fs/promises';
import { contentQuality } from './build-dashboard.mjs';
const nd = async name => (await readFile(`data/catalogo/${name}`, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const archive = await nd('arquivo-coletas.ndjson');
const reviews = new Set((await nd('revisoes-eventos.ndjson')).map(x => x.documento_id));
const texts = new Set((await nd('textos-artigos.ndjson')).filter(x => x.texto).map(x => x.documento_id));
const decisionFile = JSON.parse(await readFile('state/news-state.json', 'utf8'));
const decisions = decisionFile.decisions || {};
const records = [];
for (const row of archive) {
  if (reviews.has(row.id) || texts.has(row.id)) continue;
  const short = contentQuality(row.titulo, row.trecho) !== 'trecho_disponivel';
  const noText = /sem texto para classifica|texto insuficiente|falta de informa/i.test(`${decisions[row.id]?.reason || ''} ${row.situacao_analise || ''}`);
  const failure = Boolean(row.article_recovery_reason);
  if (!short && !noText && !failure) continue;
  records.push({ id: row.id, title: row.titulo, url: row.url,
    group: short ? 'restante do grupo com título insuficiente' : noText ? 'descarte explícito por falta de texto' : 'outra recuperação sem texto integral',
    recoveryReason: row.article_recovery_reason || '',
    decisionReason: decisions[row.id]?.reason || row.situacao_analise || '' });
}
console.log(JSON.stringify({ asOf: new Date().toISOString(), archive: archive.length,
  scope: 'Registros sem revisão humana e sem texto integral, com título insuficiente, descarte explícito por falta de texto ou falha registrada de recuperação. Não é contagem de fatos relevantes.',
  counts: Object.fromEntries([...new Set(records.map(x => x.group))].map(g => [g, records.filter(x => x.group === g).length])),
  total: records.length, records }, null, 2));
