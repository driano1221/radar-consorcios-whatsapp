import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEditorialGuard,applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { decidePublication,isNotifiable } from '../src/lib/publication-gate.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
const directory=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
const rows=async name=>(await readFile(`${directory}/${name}.ndjson`,'utf8')).trim().split('\n').map(JSON.parse);
test('general-rule replay adds two facts and two duplicate links with literal evidence',async()=>{
  const reviews=(await rows('revisoes-eventos')).filter(r=>r.lote_retroativo==='regras-gerais-2026-10-16');
  const texts=await rows('textos-artigos'),archive=await rows('arquivo-coletas');
  assert.equal(reviews.length,4);assert.equal(reviews.filter(r=>r.decisao==='confirmar_evento').length,2);
  const events=await readFile(`${directory}/eventos.csv`,'utf8');
  for(const r of reviews){
    const t=texts.find(t=>t.documento_id===r.documento_id),original=archive.find(a=>a.id===r.documento_id);
    assert.equal(r.publicar,false);assert.ok(t.texto.includes(r.evidencia));
    assert.equal(createHash('sha256').update(original.trecho).digest('hex'),r.trecho_sha256);
    assert.equal(events.includes(r.documento_id),r.decisao==='confirmar_evento');
    if(r.decisao==='duplicata')assert.ok(r.documento_relacionado);
  }
});
test('new historical delta cannot enter daily messages or weekly report even if rediscovered today',async()=>{
  const reviews=(await rows('revisoes-eventos')).filter(r=>r.lote_retroativo==='regras-gerais-2026-10-16');
  const guard=await loadEditorialGuard(directory),state={seen:{},pending:{},observations:{}};
  const at='2026-10-16T12:00:00.000Z';let i=0;
  for(const r of reviews)for(const url of r.urls_documento){
    const item=decidePublication(applyEditorialGuard({url,title:r.titulo,publishedAt:at,
      classification:{category:'ATUAÇÃO',score:10,reasons:[]}},guard));
    assert.equal(isNotifiable(item),false);state.observations[i++]={item,firstSeenAt:at,lastSeenAt:at};
  }
  const result=buildWeeklyReport(state,{start:new Date('2026-10-15T00:00:00Z'),end:new Date('2026-10-17T00:00:00Z')});
  assert.equal(result.highlights.length,0);assert.equal(result.events,0);
});
test('CNM original and Conclima reproduction are separate and the original preserves the real state',async()=>{
  const original=(await rows('textos-artigos')).find(t=>t.documento_id.startsWith('74fb6772'));
  const alternative=(await rows('fontes-alternativas')).find(t=>t.documento_id===original.documento_id);
  assert.equal(original.leitor,'cnm_inertia_publica');assert.match(original.url_artigo,/\/cnm.org.br\//);
  assert.match(original.texto,/12 Municípios do Paraná/);assert.ok(!original.texto.includes('noticias_relacionadas'));
  assert.match(alternative.url_fonte,/conclima.org.br/);assert.notEqual(original.texto_sha256,alternative.texto_sha256);
});
