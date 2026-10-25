import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {classifyItem} from '../src/lib/classifier.mjs';
import {applySimpleTriage,TRIAGE_VERSION,loadOriginalTriage,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {applyAiReview,AI_PROMPT_VERSION} from '../src/lib/ai-review.mjs';
import {catalogRecord,mergeStateIntoCatalog} from '../src/lib/catalog.mjs';
import {persistArticleTexts} from '../src/lib/article-text-store.mjs';
import {upgradeLegacyTriage} from '../scripts/reprocess-triage.mjs';
import {loadEditorialGuard,applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';
import {fileURLToPath} from 'node:url';
import {prepareWeeklyState} from '../src/lib/weekly-selection.mjs';
import {buildWeeklyReport} from '../src/lib/history.mjs';
const nd=async name=>(await readFile(new URL(`../data/catalogo/${name}`,import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
const [archive,texts]=await Promise.all(['arquivo-coletas.ndjson','textos-artigos.ndjson'].map(nd));
const sources=['d7a3ab09','727e9495'].map(prefix=>{
  const row=archive.find(r=>r.id.startsWith(prefix)),text=texts.find(t=>t.documento_id===row.id);
  assert.equal(createHash('sha256').update(text.texto).digest('hex'),text.texto_sha256);
  return {title:row.titulo,url:row.url,articleUrl:text.url_artigo,rawText:text.texto,kind:'news'};
});
const decide=item=>applySimpleTriage({...item,classification:classifyItem(item)});

test('ABC e Patrocínio concluem por prova literal, sem IA, com a etapa limitada ao que foi publicado',()=>{
  for(const [index,category] of [[0,'ATUAÇÃO'],[1,'GOVERNANÇA']]) {
    const item=decide(sources[index]);
    assert.equal(item.triage.status,'confirmado');assert.equal(item.triage.category,category);
    assert.equal(item.triage.method,'regra_documental_especifica');
    assert.ok(sources[index].rawText.includes(item.triage.evidence));
    assert.equal(item.triage.nextAction,undefined);
    const bounded=applyAiReview(item,{status:'approved',category:'CRIAÇÃO',promptVersion:AI_PROMPT_VERSION});
    assert.equal(bounded.classification.category,category);
  }
  assert.match(decide(sources[0]).triage.stage,/documentação futura.*bolsas entregues não comprovadas/);
  assert.match(decide(sources[1]).triage.stage,/ementa.*anexo, novo ingresso e constituição não comprovados/);
});

test('prazo futuro ou parceria negada/hipotética não comprovam parceria firmada',()=>{
  const original=sources[0];
  for(const replacement of ['Será firmada em setembro, a parceria prevê','Não foi firmada em setembro, a parceria prevê','Se for firmada em setembro, a parceria prevê']) {
    const item=decide({...original,rawText:original.rawText.replace('Firmada em setembro, a parceria prevê',replacement)});
    assert.notEqual(item.triage.status,'confirmado',replacement);
  }
  assert.equal(decide({...original,rawText:''}).triage.status,'processando');
});

test('ementa só comprova ratificação na ficha oficial de lei publicada; projeto, notícia e data ausente não bastam',()=>{
  const source=sources[1];
  for(const change of [
    {articleUrl:'https://noticias.exemplo/norma/3142'},
    {title:'PROJETO DE LEI Nº 5956'},
    {rawText:source.rawText.replace('Data de Publicação 30/09/2026','Data de Publicação não informada')},
    {rawText:source.rawText.replace('Tipo da Norma Jurídica Lei Municipal','Tipo da Norma Jurídica Projeto de Lei')},
  ])assert.notEqual(decide({...source,...change}).triage.status,'confirmado');
});

test('varredura conclui segunda leitura de mesma versão/hash fora da fila e releitura não reabre nem muda decisões humanas',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'radar-second-reading-'));
  try {
    const records=new Map(),state={pending:{},seen:{},observations:{}};
    for(const source of sources) {
      const row=catalogRecord({...source,classification:classifyItem(source),triage:{version:TRIAGE_VERSION,status:'processando',
        nextAction:'segunda_leitura',bodyHash:createHash('sha256').update(source.rawText).digest('hex')}},'2026-10-24','2026-10-24');
      records.set(row.id,row);state.observations[row.id]={item:source,firstSeenAt:'2026-10-24',lastSeenAt:'2026-10-24'};
    }
    const human={...records.values().next().value,id:'human',decisao_base:'descartado'};
    records.set(human.id,human);const before=JSON.stringify(state);
    await persistArticleTexts(dir,sources.map(s=>({...s,contentProvenance:'pagina_original'})));
    assert.equal(await upgradeLegacyTriage(dir,records,state,new Set(['human'])),2);
    assert.deepEqual(records.get('human'),human);
    for(const row of records.values())if(row.id!=='human')assert.equal(row.decisao_base,'confirmado');
    mergeStateIntoCatalog(records,state);
    assert.equal(await upgradeLegacyTriage(dir,records,state,new Set(['human'])),0);
    assert.equal(JSON.stringify(state),before);
    for(const row of records.values())if(row.id!=='human')assert.equal(row.decisao_base,'confirmado');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('as duas conclusões históricas têm prova válida e bloqueiam alerta e resumo por ambas as URLs',async()=>{
  const dir=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
  const decisions=await loadOriginalTriage(dir),guard=await loadEditorialGuard(dir);
  const state={seen:{},observations:{}};
  for(const prefix of ['d7a3ab09','727e9495']) {
    const row=archive.find(r=>r.id.startsWith(prefix)),d=decisions.get(row.id);
    assert.equal(d.status,'confirmado');assert.ok(validOriginalTriage(row,d));
    assert.equal(d.alertAllowed,false);assert.equal(d.weeklyAllowed,false);
    assert.equal(row.decisao_base,'confirmado');assert.equal(row.triagem_automatica.status,'confirmado');
    for(const url of [row.url,d.sourceUrl]) {
      const item=applyEditorialGuard({title:row.titulo,url,classification:{category:d.category,score:99}},guard);
      assert.equal(isNotifiable(item),false);assert.equal(item.publicationDecision,'historico');
      state.observations[url]={item,firstSeenAt:'2026-10-24T12:00:00Z',lastSeenAt:'2026-10-24T12:00:00Z'};
    }
  }
  const before=JSON.stringify(state),window={start:new Date('2026-10-20T12:00:00Z'),end:new Date('2026-10-26T12:00:00Z')};
  const prepared=await prepareWeeklyState(state,dir,window);
  assert.equal(buildWeeklyReport(prepared,window).events,0);assert.equal(JSON.stringify(state),before);
});
