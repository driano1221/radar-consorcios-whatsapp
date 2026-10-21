import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { BATCH, IDS, PROCESSES, actId, applyCorrections, snapshot } from '../scripts/apply-primary-document-corrections.mjs';
import { materializeDocumentActs } from '../src/lib/document-acts.mjs';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { buildDashboardData, buildPublicDashboardData } from '../scripts/build-dashboard.mjs';
import { primaryEvidenceView } from '../dashboard/src/primary-evidence-view.mjs';
import { findIdentityMentions } from '../src/lib/consortium-identity.mjs';

const directory = fileURLToPath(new URL('../data/catalogo/', import.meta.url));
const read = async name => (await readFile(new URL('../data/catalogo/'+name,import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
const manifest = JSON.parse(await readFile(new URL('../data/catalogo/'+BATCH+'.json',import.meta.url),'utf8'));
const archive = await read('arquivo-coletas.ndjson');
const definitions = await read('atos-identificados.ndjson');
const acts = materializeDocumentActs(archive,definitions);
const reviews = await read('revisoes-eventos.ndjson');

test('reaplicação do lote é idempotente e não modifica acervo nem estado de envio', async () => {
  const before = await snapshot(directory);
  const stateDirectory=fileURLToPath(new URL('../state/',import.meta.url));
  const state=await snapshot(stateDirectory);
  assert.deepEqual(await applyCorrections({apply:true}),{alreadyApplied:true,changed:false,whatsappCalls:0});
  assert.deepEqual(await snapshot(directory),before);
  assert.deepEqual(await snapshot(stateDirectory),state);
});

test('cinco PDFs preservam bytes, páginas e trechos comprovados; revisão anterior permanece auditável', async () => {
  assert.equal(manifest.documents.length,5);
  assert.ok(manifest.previousReviews.length>=2);
  assert.equal(manifest.simulationActivated,false);
  for(const doc of manifest.documents) {
    const bytes=await readFile(new URL('../data/documentos-primarios/'+doc.file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),doc.sha256);
    for(const quote of doc.checked_quotes) assert.ok(doc.pages[quote.page-1].includes(quote.quote));
  }
  for(const review of manifest.appliedReviews) for(const proof of review.documentos_primarios) {
    const doc=manifest.documents.find(d=>d.sha256===proof.pdf_sha256);
    assert.ok(doc.pages[proof.pagina-1].includes(proof.trecho));
    assert.equal(doc.url,proof.url);
  }
});

test('TCE materializa três PDFs oficiais sem extensão .pdf, mantendo fonte, data e IDs distintos', () => {
  const children=acts.filter(a=>a.documento_pai_id===IDS.tce);
  assert.equal(children.length,3);
  assert.equal(new Set(children.map(a=>a.id)).size,3);
  for(const n of PROCESSES) {
    const act=children.find(a=>a.id===actId(n));
    assert.ok(act); assert.equal(act.fonte,'TCE-MG · acórdão');
    assert.match(act.url,/tcnotas.tce.mg.gov.br/);
    assert.match(act.data_publicacao,n==='1210770'?/2026-10-14/:/2026-10-08/);
  }
});

test('quatro fatos canônicos, sem duplicar a notícia do TCE nem a segunda URL de Divinópolis', async () => {
  const csv=await readFile(new URL('../data/catalogo/eventos.csv',import.meta.url),'utf8');
  // Trechos literais podem conter quebras de linha dentro da célula CSV.
  const ids=[...csv.matchAll(/^"([a-f0-9]{64})",/gm)].map(match=>match[1]);
  for(const id of [IDS.div,...PROCESSES.map(actId)]) assert.equal(ids.filter(v=>v===id).length,1);
  for(const id of [IDS.tce,IDS.duplicate]) assert.ok(!ids.includes(id));
  assert.equal(ids.length,new Set(ids).size);
  const div=reviews.find(r=>r.documento_id===IDS.div);
  assert.match(div.etapa,/sem extinção efetiva comprovada/);
  const fine=reviews.find(r=>r.documento_id===actId('1210770'));
  assert.equal(fine.fatos.destinatario_multa,'Frederico Ozanan Rangel');
  assert.match(fine.motivo,/não comunicar a revogação/);
});

test('URLs antigas e PDFs reaparecidos não são elegíveis ao alerta nem ao resumo, mesmo com data atual', async () => {
  const guard=await loadEditorialGuard(directory);
  const observations={}; let index=0;
  for(const review of manifest.appliedReviews) for(const url of review.urls_documento||[]) {
    const item=decidePublication(applyEditorialGuard({url,title:review.titulo||'Notícia antiga',
      publishedAt:'2026-10-16T17:00:00Z',classification:{category:'CONTROLE',score:12,reasons:[]}},guard),
      {now:new Date('2026-10-16T18:00:00Z')});
    assert.equal(isNotifiable(item),false,url);
    if(review.decisao==='confirmar_evento') assert.equal(item.publicationDecision,'historico',url);
    observations[index++]={item,firstSeenAt:'2026-10-16T17:00:00Z',lastSeenAt:'2026-10-16T17:00:00Z'};
  }
  const report=buildWeeklyReport({seen:{},pending:{},observations},
    {start:new Date('2026-10-15'),end:new Date('2026-10-18')});
  assert.equal(report.events,0); assert.equal(report.highlights.length,0);
});

test('painel público mantém notícia original, provas paginadas e divergência explícita do CONSANE', () => {
  const data=buildPublicDashboardData(buildDashboardData({archive,acts,events:[],consortia:[],links:[],pendingIdentity:[],editorialReviews:reviews}));
  for(const id of [IDS.tce,actId('1217968')]) {
    const item=data.items.find(i=>i.id===id);
    assert.match(item.sourceDivergence.noticia,/1217068/);
    assert.match(item.sourceDivergence.documento,/1217968/);
    assert.match(item.sourceDivergence.criterio,/Não há correspondência exata/);
    assert.ok(item.primaryDocuments.length>=2);
    const document=new JSDOM('<!doctype html><body></body>').window.document;
    const view=primaryEvidenceView(item,{document}); document.body.append(view);
    assert.match(view.textContent,/Divergência entre notícia e documento/);
    assert.match(view.textContent,/Página 2/);
    assert.ok(view.querySelector('a[href$="#page=2"]'));
  }
  const original=data.items.find(i=>i.id===IDS.tce);
  const raw=archive.find(r=>r.id===IDS.tce);
  assert.equal(original.url,raw.article_url||raw.url);
});

test('provas não geram HTML executável nem links inseguros', () => {
  const document=new JSDOM('<!doctype html><body></body>').window.document;
  const view=primaryEvidenceView({primaryDocuments:[{title:'<script>alert(1)</script>',page:1,excerpt:'<img onerror=alert(1)>',url:'javascript:alert(1)'}]}, {document});
  assert.equal(view.querySelectorAll('script,img,a').length,0);
  assert.match(view.textContent,/<script>/);
});

test('nome revisado com hífen não cria outra entidade pelo nome parcial dos metadados', () => {
  const nome='Consórcio Regional de Promoção da Cidadania - Mulheres das Gerais';
  const mentions=findIdentityMentions({tipo_evento:'GOVERNANÇA',consorcio:nome,
    curatedMentions:[{nome,fonte_evidencia:'https://example.org/lei.pdf'}]});
  assert.equal(mentions.length,1); assert.equal(mentions[0].name,nome);
});
