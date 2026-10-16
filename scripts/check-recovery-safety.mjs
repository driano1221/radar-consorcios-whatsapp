import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const jsonl = async (file) => (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const directory = 'data/catalogo/';
const rows = await jsonl(`${directory}arquivo-coletas.ndjson`);
const reviews = await jsonl(`${directory}revisoes-eventos.ndjson`);
const reviewed = new Set(reviews.map(r => r.documento_id));
const state = {};
for (const name of await readdir('state', { withFileTypes: true })) {
  if (name.isFile()) state[name.name] = hash(await readFile(`state/${name.name}`));
}
const snapshot = {
  ids: rows.map(r => r.id).sort(), state,
  reviews: hash(await readFile(`${directory}revisoes-eventos.ndjson`)),
  acts: hash(await readFile(`${directory}atos-identificados.ndjson`)),
  sent: rows.map(r => [r.id, r.enviado_em || '', r.decisao_alerta || '', r.motivo_alerta || '']).sort(),
  decisions: rows.filter(r => reviewed.has(r.id)).map(r => [r.id, r.trecho, r.etapa,
    r.tipo_evento, r.situacao_analise]).sort(),
};
await mkdir('output', { recursive: true });
const file = 'output/recovery-safety.json';
if (process.argv.includes('--before')) {
  await writeFile(file, JSON.stringify(snapshot));
  console.log(`[segurança] Fotografia de ${rows.length} documentos; ${reviewed.size} revisões; estado de envios protegido.`);
} else {
  assert.deepEqual(snapshot, JSON.parse(await readFile(file, 'utf8')),
    'Recuperação não pode criar documentos/atos, mudar revisão ou alterar estado de envios');
  console.log('[segurança] IDs, atos, decisões revisadas, prova lacrada e estado de envios INALTERADOS.');
}
