import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {classifyItem} from '../src/lib/classifier.mjs';
import {decideSimpleTriage,loadOriginalTriage} from '../src/lib/simple-triage.mjs';
import {loadEditorialGuard,applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';
import {buildDashboardData} from '../scripts/build-dashboard.mjs';
import {newsRecord,newsCsv} from '../dashboard/src/news-view.mjs';
const directory=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
const read=async name=>(await readFile(`${directory}/${name}.ndjson`,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const hash=value=>createHash('sha256').update(value).digest('hex');
const classify=(title,rawText,kind='news')=>{
 const item={kind,title,rawText,url:'https://fonte.exemplo/ato'};
 return {classification:classifyItem(item),triage:decideSimpleTriage({...item,classification:classifyItem(item)})};
};

test('cadastro aberto é atuação iniciada, sem inferir mapeamento concluído de plano futuro ou de outro ator',async()=>{
 const text=(await read('textos-artigos')).find(t=>t.documento_id.startsWith('01ba9f2a32b9')).texto;
 const title='Consórcio lança mapeamento cultural';
 const current=classify(title,text);
 assert.equal(current.triage.status,'confirmado');assert.equal(current.classification.category,'ATUAÇÃO');
 assert.match(current.triage.stage,/cadastro aberto.*conclusão não comprovada/);
 assert.ok(text.includes(current.triage.evidence));
 for(const body of [text.replaceAll('lançou','lançará'),text.replaceAll('lançou','não lançou'),text.replace('O Consórcio Intermunicipal Grande ABC lançou','Se o Consórcio Intermunicipal Grande ABC lançou'),
  'A Prefeitura de Azul lançou um mapeamento cultural. O consórcio acompanha a iniciativa. A iniciativa convida líderes e representantes de escolas de samba a participarem do cadastro. O formulário de inscrição já está aberto.'])
  assert.notEqual(classify(title,body).triage.status,'confirmado');
 const summary={kind:'news',title,summary:text,url:'https://fonte.exemplo/ato'};
 assert.notEqual(decideSimpleTriage({...summary,classification:classifyItem(summary)}).status,'confirmado');
});

test('lei que ratifica alteração contratual confirma só a ratificação, sem exigir o anexo nem inventar ingresso',async()=>{
 const text=(await read('textos-artigos')).find(t=>t.documento_id.startsWith('5bd1b93b5c80')).texto;
 const current=classify('LEI MUNICIPAL NR. 2.986, DE 15/10/2026',text,'gazette');
 assert.equal(current.triage.status,'confirmado');assert.equal(current.classification.category,'GOVERNANÇA');
 assert.match(current.triage.stage,/teor do anexo e novo ingresso não comprovados/);
 assert.ok(text.includes(current.triage.evidence));
 assert.notEqual(classify('PROJETO DE LEI NR. 2.986',text,'gazette').triage.status,'confirmado');
 assert.notEqual(classify('LEI MUNICIPAL NR. 2.986',text.replace('Fica ratificada alteração','Não fica ratificada alteração'),'gazette').triage.status,'confirmado');
});

test('casos manuais 3–13 preservam prova e escopo, não viram PDF integral nem liberam acervo no WhatsApp',async()=>{
 const [archive,reviews,texts,guard,originalDecisions]=await Promise.all([
  read('arquivo-coletas'),read('revisoes-eventos'),read('textos-artigos'),loadEditorialGuard(directory),loadOriginalTriage(directory)]);
 const batch=reviews.filter(r=>r.lote_retroativo==='revisao-manual-3-13-2026-10-22');
 assert.deepEqual(batch.map(r=>r.caso_lista_manual),[3,4,5,6,7,8,9,10,11,12,13]);
 assert.deepEqual(batch.filter(r=>r.decisao==='confirmar_evento').map(r=>r.caso_lista_manual),[9,13]);
 const ids=new Set(batch.map(r=>r.documento_id));
 const data=buildDashboardData({archive:archive.filter(r=>ids.has(r.id)),events:[],consortia:[],links:[],pendingIdentity:[],editorialReviews:batch,originalDecisions});
 for(const r of batch) {
  const row=archive.find(a=>a.id===r.documento_id),item=data.items.find(i=>i.id===r.documento_id);
  assert.equal(hash(row.trecho||''),r.trecho_sha256);assert.equal(hash(r.leitura_usuario.relato),r.leitura_usuario.relato_sha256);
  assert.equal(r.publicar,false);assert.equal(r.incluir_resumo,false);assert.deepEqual(item.reviewChecks,[]);
  assert.equal(newsRecord(item).decision,r.decisao==='confirmar_evento'?'Confirmada':'Rejeitada');
  for(const url of r.urls_documento)assert.equal(isNotifiable(applyEditorialGuard({url,classification:{category:'ATUAÇÃO',score:99}},guard)),false);
  if(r.decisao==='confirmar_evento'){
   const full=texts.find(t=>t.documento_id===r.documento_id);
   assert.equal(full.texto_sha256,r.texto_evidencia_sha256);assert.ok(full.texto.includes(r.evidencia));
  }else assert.equal(r.texto_evidencia_sha256,undefined,'Relato do usuário não é uma íntegra recuperada');
 }
 assert.doesNotMatch(newsCsv(data.items),/Revisar comigo|Em processamento automático/);
 assert.match(batch.find(r=>r.caso_lista_manual===10).motivo,/sem vínculo textual demonstrado/);
 for(const prefix of ['1bc1d2cd2108','4a51b6537e62']){
  const decision=[...originalDecisions.values()].find(d=>d.documentId.startsWith(prefix));
  assert.equal(decision.status,'confirmado');assert.equal(decision.method,'inferencia_autorizada_pelo_usuario');
 }
});
