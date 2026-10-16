import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { materializeDocumentActs } from '../src/lib/document-acts.mjs';
import { buildDashboardData } from '../scripts/build-dashboard.mjs';
import { applyAiReview, AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';
const read=async name=>(await readFile(new URL(`../data/catalogo/${name}.ndjson`,import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
const archive=await read('arquivo-coletas'), texts=await read('textos-artigos');
const reviews=await read('revisoes-eventos'), definitions=await read('atos-identificados');
const pdf=await read('recuperacao-pdf-google');
const parent=archive.find(r=>r.id.startsWith('51841641'));
const acts=materializeDocumentActs(archive,definitions).filter(a=>a.documento_pai_id===parent.id);

test('texto sem consórcio é recuperado e pode fundamentar descarte, não falha de leitura',async()=>{
  const text=texts.find(t=>t.documento_id.startsWith('8dd892b3')).texto;
  const reasons=[];
  const item=await enrichArticle({title:'Progov reconhece boas práticas',url:'https://exemplo.gov.br/noticia'}, {
    fetchImpl:async()=>new Response('<article>Notícia</article>',{headers:{'content-type':'text/html'}}),
    readability:()=>text,trafilatura:async()=>text,onFailure:(_,r)=>reasons.push(r),
  });
  assert.equal(item.rawText,text); assert.equal(item.contentProvenance,'pagina_original');
  assert.deepEqual(reasons,[]); assert.equal(classifyItem(item).category,'GERAL');
});

test('CIM-AMFRI: acompanhamento da operação não é fiscalização contra o consórcio',()=>{
  const row=archive.find(r=>r.id.startsWith('635e46ab'));
  const text=texts.find(t=>t.documento_id===row.id).texto;
  const result=classifyItem({title:row.titulo,rawText:text});
  assert.equal(result.category,'ATUAÇÃO'); assert.match(result.stage,/não é punição/);
  assert.equal(classifyItem({title:row.titulo,rawText:text.replaceAll('CIM-AMFRI','CIM-REGIONAL')}).category,'ATUAÇÃO');
});

for(const act of acts)test(`TCE: ${act.chave_ato} tem resultado e prova próprios`,()=>{
  const parts=pdf.find(p=>p.documento_id===parent.id).trechos.filter(p=>p.chave_ato===act.chave_ato);
  const body=parts.map(p=>p.texto).join(' ');
  const result=classifyItem({kind:'gazette',title:act.titulo,rawText:body});
  assert.equal(result.category,'CONTROLE'); assert.ok(result.score>=5);
  assert.ok(!result.reasons.some(r=>r.startsWith('rejeitado:')));
  assert.match(act.url,/^https:\/\/doc\.tce\.mg\.gov\.br\/.+\.pdf#page=\d+$/);
  if(act.sigla==='CIMARG')assert.match(result.stage,/cautelar/);
  if(['CNIF','ICISMEP','CIMCENTRAL'].includes(act.sigla))assert.match(result.stage,/sem julgamento de mérito/);
});

test('painel não mistura processos que compartilham a mesma página do PDF',()=>{
  const data=buildDashboardData({archive:[parent],events:acts,acts,consortia:[],links:[],pendingIdentity:[],pdfRecovery:pdf,editorialReviews:reviews});
  const cnif=data.items.find(i=>i.title.includes('CNIF'));
  assert.ok(cnif.pdfEvidence.length);
  assert.ok(cnif.pdfEvidence.every(p=>p.text.includes('1217718')&&!p.text.includes('1217658')));
  const central=data.items.find(i=>i.title.includes('CIMCENTRAL'));
  assert.ok(central.pdfEvidence.every(p=>p.text.includes('1217658')&&!p.text.includes('1217718')));
  assert.equal(data.items.find(i=>i.id===parent.id).baseDecision,'desdobrado');
});

test('lei histórica com publicação original comprovada fica na base e fora de alertas',()=>{
  const row=archive.find(r=>r.id.startsWith('b06ea64f'));
  const review=reviews.find(r=>r.documento_id===row.id);
  const data=buildDashboardData({archive:[row],events:[{...row,tipo_evento:'PROTOCOLO',decisao_alerta:'historico',motivo_alerta:review.motivo_publicacao}],consortia:[],links:[],pendingIdentity:[],editorialReviews:[review]});
  const item=data.items[0];
  assert.equal(item.baseDecision,'confirmado');assert.equal(item.alertDecision,'historico');
  assert.ok(item.publishedAt.startsWith('2022-12-06'));
  assert.equal(item.fullText,''); // Corpo da lei conferido via web não é anexo integral recuperado.
});

test('links repetidos de norma e atendimento não contam fatos novos',()=>{
  for(const [prefix,canonical]of[['5b859e7b','d86bf9a8'],['0783e43a','a229b70e']]){
    const review=reviews.find(r=>r.documento_id.startsWith(prefix));
    assert.equal(review.decisao,'duplicata');assert.ok(review.documento_relacionado.startsWith(canonical));
  }
});

test('ementas de vários processos não acionam a regra de ato individualizado',()=>{
  const parts=pdf.find(p=>p.documento_id===parent.id).trechos.map(p=>p.texto).join(' ');
  const result=classifyItem({kind:'gazette',title:'Diário Oficial de Contas',rawText:parts});
  assert.ok(!result.reasons.includes('decisão de controle em processo individualizado com consórcio identificado'));
});

test('IA não transforma acompanhamento técnico ou arquivamento em crise',()=>{
  for(const [category,proofKind]of[['ATUAÇÃO','inspection_participation'],['CONTROLE','court_decision']]){
    const item={classification:{category,proofKind,score:8}};
    const result=applyAiReview(item,{status:'approved',category:'CRISE',promptVersion:AI_PROMPT_VERSION});
    assert.equal(result.classification.category,category);
    assert.equal(result.aiReview.proposedCategory,'CRISE');
  }
});
