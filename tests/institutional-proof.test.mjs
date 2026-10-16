import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyItem } from '../src/lib/classifier.mjs';
import { institutionalProof } from '../src/lib/institutional-proof.mjs';
import { institutionalEventKey } from '../src/lib/event-identity.mjs';
import { loadConfirmedEventRegistry } from '../src/lib/editorial-guard.mjs';
import { selectUnseen } from '../src/lib/dedupe.mjs';
import { applyAiReview, AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';
const textRows = readFileSync(new URL('../data/catalogo/textos-artigos.ndjson', import.meta.url), 'utf8').trim().split('\n').map(JSON.parse);
const archive = readFileSync(new URL('../data/catalogo/arquivo-coletas.ndjson', import.meta.url), 'utf8').trim().split('\n').map(JSON.parse);
const classify = (body, title='Atividade regional') => classifyItem({kind:'news',title,rawText:body,summary:body,url:'https://example.org/noticia/1'});
test('real cases classify without an editorial override', () => {
  for (const [prefix, expected] of [['b940d094','ATUAÇÃO'],['f46c947c','ATUAÇÃO'],['cfbb82ef','ATUAÇÃO'],['0c2c9c6b','GOVERNANÇA'],['e41368d4','GERAL']]) {
    const r=archive.find(r=>r.id.startsWith(prefix)), t=textRows.find(t=>t.documento_id===r.id);
    const result=classify(t.texto,r.titulo); assert.equal(result.category,expected,prefix);
    assert.ok(t.texto.includes(result.evidenceText));
    if(expected!=='GERAL') assert.ok(result.score>=5);
    if(prefix==='0c2c9c6b') assert.deepEqual(result.compositionMunicipalities,['Curitibanos','Frei Rogério','Ponte Alta do Norte','São Cristóvão do Sul']);
  }
});
const padding=' O encontro integra a agenda regional de gestão e pretende contribuir para a cooperação entre os municípios, sem anunciar entregas ou novos contratos.';
test('subject and past tense generalize beyond ABC, without confusing participation', () => {
  for(const name of ['Consórcio Intermunicipal Vale Verde','Consórcio Público Intermunicipal do Alto Rio']) {
    assert.equal(classify(`O ${name} realizou ontem uma visita técnica ao centro de treinamento municipal.${padding}`).category,'ATUAÇÃO');
    for(const sentence of [`O ${name} não realizou a visita técnica.`, `O ${name} realizará uma visita técnica.`,
      `O ${name} participou da reunião promovida pela associação.`, `O ${name} informou que a prefeitura realizou uma visita técnica.`,
      `O ${name}, a prefeitura realizou uma visita técnica.`, `O ${name} enquanto o prefeito realizou uma reunião.`,
      `Caso o ${name} realizou uma reunião, ainda não há confirmação.`, `O ${name} teria realizado uma visita técnica.`])
      assert.equal(institutionalProof({rawText:sentence+padding,kind:'news'}),null,sentence);
  }
});
test('composition does not infer accession or accept ambiguous entities and non-town lists', () => {
  const name='O Consórcio Intermunicipal Vale Verde, com sede regional, apoia os municípios.';
  const valid=name+' O consórcio é formado por Rio Claro e Santa Maria.'+padding;
  const c=classify(valid,'Processo seletivo'); assert.equal(c.proofKind,'documented_composition');
  assert.match(c.stage,/ingresso original.*desconhecidos/);
  for(const text of [valid.replace('é formado','será formado'), valid.replace('Rio Claro e Santa Maria','empresas e bancos'),
    valid.replace(' O consórcio é',' O Consórcio Intermunicipal Serra Azul, também participou. O consórcio é'),
    valid.replace(' O consórcio é',' Não é verdade que o consórcio é')])
    assert.notEqual(institutionalProof({rawText:text,kind:'news'})?.proofKind,'documented_composition');
});
test('no body means no proof; gazette editions cannot inherit a news activity', () => {
  assert.equal(institutionalProof({title:'Consórcio Intermunicipal Vale Verde realizou visita técnica',rawText:''}),null);
  assert.equal(institutionalProof({kind:'gazette',rawText:'O Consórcio Intermunicipal Vale Verde realizou uma reunião.'+padding}),null);
});
test('same dated Braskem proof links another publisher; different dates and missing date do not', async () => {
  const item = prefix => { const r=archive.find(r=>r.id.startsWith(prefix));const text=textRows.find(t=>t.documento_id===r.id);
    return { title:r.titulo, url:text.url_artigo,rawText:text.texto,publishedAt:r.data_publicacao,classification:classify(text.texto,r.titulo) }; };
  const a=item('f46c947c'), b=item('965b6035');
  assert.ok(institutionalEventKey(a)); assert.equal(institutionalEventKey(a),institutionalEventKey(b));
  assert.notEqual(institutionalEventKey(a),institutionalEventKey({...b,rawText:b.rawText.replace('(9/9)','(10/9)')}));
  assert.equal(institutionalEventKey({...b,rawText:b.rawText.replace('(9/9)','')}),'');
  const confirmedEvents=await loadConfirmedEventRegistry(fileURLToPath(new URL('../data/catalogo/',import.meta.url)));
  assert.equal(selectUnseen([b],{seen:{},pending:{}},{confirmedEvents}).length,0);
});
test('signed cooperation is a fact, but another publisher does not create another event',async()=>{
  const confirmedEvents=await loadConfirmedEventRegistry(fileURLToPath(new URL('../data/catalogo/',import.meta.url)));
  for(const prefix of ['1bb8aa8d','68160372','a22322a6','cea72684']){
    const t=textRows.find(r=>r.documento_id.startsWith(prefix));
    const c=classify(t.texto);assert.equal(c.category,'ATUAÇÃO');assert.equal(c.proofKind,'signed_cooperation');
    assert.ok(t.texto.includes(c.evidenceText));
    if(prefix==='cea72684')assert.equal(selectUnseen([{title:'Outra reportagem',url:t.url_artigo,rawText:t.texto,publishedAt:'2026-09-11',classification:c}],{seen:{},pending:{}},{confirmedEvents}).length,0);
  }
});
test('signature of municipal protocol is not operational accession, including a national consortium',()=>{
  const sources=readFileSync(new URL('../data/catalogo/fontes-alternativas.ndjson',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
  const text=sources.find(s=>s.documento_id.startsWith('74fb6772')).texto;
  const c=classify(text);assert.equal(c.category,'PROTOCOLO');assert.equal(c.proofKind,'signed_municipal_protocol');
  assert.match(c.stage,/ingresso efetivo.*não comprovados/);
  assert.equal(institutionalProof({rawText:text.replace('assinaram','pretendem assinar')})?.proofKind,undefined);
});
test('AI cannot promote activity or documented composition into accession or creation',()=>{
  for(const [prefix,category] of [['f46c947c','ATUAÇÃO'],['0c2c9c6b','GOVERNANÇA']]) {
    const text=textRows.find(t=>t.documento_id.startsWith(prefix)).texto;
    const item={classification:classify(text)};
    assert.equal(applyAiReview(item,{promptVersion:AI_PROMPT_VERSION,status:'approved',category:'CRIAÇÃO'}).classification.category,category);
  }
});
