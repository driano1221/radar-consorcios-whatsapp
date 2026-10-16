import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareV6,decideV6,readV6,completedAssembly,priorAssemblyInBill,hostedOpening,enactedConsolidation,deniedRumorOnly,normalizeV6Answer,VERSION} from '../scripts/lib/original-v6.mjs';
import {sha} from '../scripts/lib/original-triage-shadow.mjs';
import {prepareProcess} from '../scripts/lib/original-v5.mjs';
const nd=async file=>(await readFile(new URL('../data/catalogo/'+file+'.ndjson',import.meta.url),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const texts=await nd('textos-artigos'),archive=await nd('arquivo-coletas');
const initial=JSON.parse(await readFile(new URL('../docs/simulacao-v6-resultado.json',import.meta.url),'utf8'));
function saved(prefix){return initial.results.find(x=>x.id.startsWith(prefix)).review;}
function real(prefix){const s=texts.find(x=>x.documento_id.startsWith(prefix));return prepareV6(archive.find(x=>x.id===s.documento_id),s);}
function review(p,changes={}){const f=p.v6Fact;return {version:VERSION,inputHash:p.inputHash,textHash:p.textHash,contentReviewKey:sha(VERSION+'\n'+p.item.rawText),
  answer:{incerto:false,multiplos_atos:false,relevante:true,categoria:p.rule.category,escopo:'entidade',entidade:f.entity,
    evidencia_entidade:f.evidence,evidencia:f.evidence,tipo_fato:f.kind,justificativa:'Fato comprovado no corpo, preservada sua etapa específica.',...changes}};}
test('v6 Mulheres: assembleia do próprio consórcio realizada, não mero convidado',()=>{
  const p=real('a40ed223');assert.ok(p.v6Fact);assert.equal(p.rule.category,'ATUAÇÃO');
  const result=decideV6(p,review(p));assert.equal(result.decision,'aceito');
  assert.match(result.reason,/Não comprova/);assert.equal(result.supportEvidence.length,2);
  assert.equal(p.item.rawText.slice(result.evidenceLocation.start,result.evidenceLocation.end),result.evidence);
});
test('v6 reunião: futuro, negação, notícia relacionada e participação passiva não bastam',()=>{
  const body=real('a40ed223').item.rawText;
  for(const b of [body.replace('participou de','participará de'),body.replace('participou de','não participou de'),
    body.replace('abordaram','abordarão'),body.replace('abordaram','não abordaram'),
    body.replace('assembleia do Consórcio','assembleia com o Consórcio'),body.replace('O Ministério Público','LEIA TAMBÉM: O Ministério Público'),
    'O Consórcio Intermunicipal Vale Azul participou de uma assembleia da Associação Regional para discutir política social. Durante o encontro, autoridades abordaram as propostas.'])assert.equal(completedAssembly(b),null,b);
});
test('v6 reunião: nome renomeado funciona; duas assembleias não se fundem',()=>{
  const body=real('a40ed223').item.rawText.replaceAll('Mulheres das Gerais','Vale Azul');
  assert.equal(completedAssembly(body).entity,'Consórcio Intermunicipal Vale Azul');
  assert.equal(completedAssembly(body+' '+body),null);
});
test('v6 assembleia: acordo imaginado, identidade do convidado, prova trocada não passam',()=>{
  const p=real('a40ed223');
  for(const a of [{tipo_fato:'acordo_firmado'},{entidade:'Ministério Público de Minas Gerais'},
    {evidencia:'A reunião destacou que o trabalho conjunto entre o Ministério Público e os municípios integrados ao consórcio é essencial para garantir a sustentabilidade financeira, a melhoria da infraestrutura e a ampliação dos serviços prestados.'},
    {relevante:false,categoria:'IRRELEVANTE'},{incerto:true},{multiplos_atos:true}])assert.notEqual(decideV6(p,review(p,a)).decision,'aceito');
});
test('v6 CISAMREC: deliberação anterior relatada em projeto, sem ratificação municipal',()=>{
  const p=real('fb3492e1');assert.ok(p.v6Fact);assert.equal(p.rule.category,'GOVERNANÇA');
  const r=decideV6(p,review(p));assert.equal(r.decision,'aceito');assert.equal(r.reportedYear,2025);
  assert.match(r.sourceQualification,/ato original não conferido/);assert.match(r.reason,/ratificação municipal continua proposta/);
});
test('v6 projeto: proposta pura, ato futuro, ausência de ata e hipótese não passam',()=>{
  const body=real('fb3492e1').item.rawText;
  for(const b of [body.replace('foi consolidado e deliberado','será consolidado e deliberado'),
    body.replace('foi consolidado e deliberado','não foi consolidado e deliberado'),body.replace('conforme ATA publicada','conforme ATA a publicar'),
    body.replace('solicito a aprovação','informo a aprovação'),body.replace('O texto consolidado','Não é verdade que O texto consolidado'),
    body.replace('Art. 2º.','LEIA TAMBÉM: Art. 2º.')])assert.equal(priorAssemblyInBill(b),null,b.slice(0,100));
});
test('v6 projeto: nome e ano variáveis, não regra por caso',()=>{
  const body=real('fb3492e1').item.rawText.replaceAll('CISAMREC','CISAZUL').replaceAll('30/10/2025','10/08/2024');
  assert.equal(priorAssemblyInBill(body).year,2024);assert.match(priorAssemblyInBill(body).entity,/CISAZUL/);
});
test('v6 projeto: evidência do art.1 proposto não prova aprovação anterior',()=>{
  const p=real('fb3492e1'),b=p.item.rawText,q=b.slice(b.indexOf('Art. 1º'),b.indexOf('Art. 2º')).trim();
  assert.equal(decideV6(p,review(p,{evidencia:q})).reason,'prova_da_etapa_e_do_titular_divergente');
  assert.notEqual(decideV6(p,review(p,{tipo_fato:'ratificacao_municipal'})).decision,'aceito');
});
test('v6 novas leituras exigem hash/versão; não maquiar replay como nova API',()=>{
  const p=real('fb3492e1');assert.equal(decideV6(p,{...review(p),version:'original-shadow-5.0'}).reason,'segunda_leitura_desatualizada');
  assert.equal(decideV6(p,{...review(p),textHash:'wrong'}).reason,'segunda_leitura_desatualizada');
});
test('v6 API envia somente corpo original e identifica política nova',async()=>{
  const p=real('fb3492e1');let payload;
  const r=await readV6(p,{apiKey:'test-only',fetchImpl:async(u,o)=>{payload=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}));}});
  assert.equal(r.version,VERSION);assert.match(payload.messages[0].content,/completed course/);assert.match(payload.messages[0].content,/deliberacao_anterior_relatada/);
  assert.deepEqual(JSON.parse(payload.messages[1].content),{corpo:p.item.rawText});
});
test('v6 regressão: repara nome omitido somente se a IA citou o nome integral literal',()=>{
  const p=real('35799042'),r=saved('35799042'),result=decideV6(p,r);
  assert.equal(result.decision,'aceito');assert.equal(result.entity,r.answer.evidencia_entidade);
  assert.equal(r.answer.entidade,undefined);assert.equal(result.modelAnswer.entidade,undefined);
  for(const q of ['Consórcio Inventado','MUNICÍPIO DE ALTO PARAGUAI',r.answer.evidencia_entidade+' inventado'])
    assert.notEqual(decideV6(p,{...r,answer:{...r.answer,evidencia_entidade:q}}).decision,'aceito');
});
test('v6 regressão: tipo genérico corrigido só com duas provas de oficina efetivamente sediada',()=>{
  const p=real('473cca93'),r=saved('473cca93');assert.equal(decideV6(p,r).decision,'aceito');
  assert.equal(r.answer.tipo_fato,'outro');
  assert.notEqual(decideV6(p,{...r,answer:{...r.answer,tipo_fato:'acordo_firmado'}}).decision,'aceito');
  assert.notEqual(decideV6(p,{...r,answer:{...r.answer,evidencia:r.answer.evidencia.replace('sediou','sediará')}}).decision,'aceito');
});
test('v6 regressão: recomendação deve estar citada pelo modelo, não inserida pela regra',()=>{
  const p=real('5e27bff7'),r=saved('5e27bff7'),result=decideV6(p,r);
  assert.equal(result.decision,'aceito');assert.equal(result.category,'CONTROLE');
  assert.match(result.evidence,/foi entregue/);assert.match(result.reason,/sem presumir/);
  for(const extra of [[],['Ao final da audiência, seria entregue a Recomendação'],r.answer.evidencias_complementares[0]])
    assert.notEqual(decideV6(p,{...r,answer:{...r.answer,evidencias_complementares:extra}}).decision,'aceito');
  assert.notEqual(decideV6(p,{...r,answer:{...r.answer,tipo_fato:'outro'}}).decision,'aceito');
});
test('v6 boato negado e proposta sem ato consumado não é crise; outro ato impede exclusão',()=>{
  const p=real('2e4c11e2');assert.equal(decideV6(p,saved('2e4c11e2')).decision,'descartado');
  const base={...p,rule:{...p.rule,category:'GERAL'}};
  for(const suffix of [' O consórcio assinou um protocolo.', ' Foi aprovado o encerramento.', ' A entidade recebeu recursos.', ' LEIA TAMBÉM: O consórcio ratificou o ajuste.'])
    assert.equal(deniedRumorOnly({...base,item:{...p.item,rawText:p.item.rawText+suffix}}),null);
  assert.equal(deniedRumorOnly({...base,item:{...p.item,rawText:p.item.rawText.replace('a informação não procede','a informação procede')}}),null);
});
test('v6 CISAN: município sedia assembleia do consórcio, pauta não é entrega',()=>{
  const p=real('42396b5f'),r=decideV6(p,saved('42396b5f'));assert.equal(r.decision,'aceito');
  assert.equal(r.factType,'assembleia_realizada');assert.match(r.reason,/Não comprova/);
  for(const b of [p.item.rawText.replace('sediou','sediará'),p.item.rawText.replace('sediou','não sediou'),
    p.item.rawText.replace('O encontro reuniu','O encontro reunirá'),p.item.rawText.replace('do Consórcio','com o Consórcio')])assert.equal(completedAssembly(b),null);
});
test('v6 aula inaugural recebida e ministrada não significa conclusão de curso',()=>{
  const p=real('ca0b94ca'),r=decideV6(p,saved('ca0b94ca'));assert.equal(r.decision,'aceito');assert.match(r.reason,/Não comprova conclusão/);
  for(const b of [p.item.rawText.replace('recebeu','receberá'),p.item.rawText.replace('recebeu','não recebeu'),
    p.item.rawText.replace('foi ministrada','será ministrada'),p.item.rawText.replace('foi ministrada','não foi ministrada'),
    'LEIA TAMBÉM: '+p.item.rawText])assert.equal(hostedOpening(b),null);
});
test('v6 CEMMIL: lei promulgada ratifica consolidação, minuta não recebe a regra',()=>{
  const p=real('5b859e7b'),r=decideV6(p,saved('5b859e7b'));assert.equal(r.decision,'aceito');assert.match(r.reason,/Não comprova novo ingresso/);
  for(const item of [{...p.item,title:'Projeto de Lei Ordinária'},
    {...p.item,rawText:p.item.rawText.replace('eu promulgo','eu proponho')},
    {...p.item,rawText:p.item.rawText+' Este é o presente projeto de lei.'},
    {...p.item,rawText:p.item.rawText.replace('Fica ratificado','Ficará ratificado')}])assert.equal(enactedConsolidation(item),null);
});
test('v6 Conclima: normaliza rótulo só com mesma prova de projeto aprovado, sem sanção inferida',()=>{
  const p=real('abf928ab'),r=saved('abf928ab'),result=decideV6(p,r);assert.equal(result.decision,'aceito');
  assert.equal(result.category,'ADESÃO AUTORIZADA');assert.match(result.stage,/sanção, ingresso efetivo e operação não comprovados/);
  for(const quote of [r.answer.evidencia.replace('aprovou','aprovará'),r.answer.evidencia.replace('aprovou','não aprovou')])
    assert.notEqual(decideV6(p,{...r,answer:{...r.answer,evidencia:quote}}).decision,'aceito');
  assert.equal(normalizeV6Answer(p,{...r,answer:{...r.answer,categoria:'ADESÃO'}}).repairs.length,0);
});
test('v6 reparos nunca anulam versão/hash, incerteza ou multiplicidade',()=>{
  const p=real('35799042'),r=saved('35799042');
  for(const changed of [{...r,version:'antiga'},{...r,textHash:'outro'},
    {...r,answer:{...r.answer,incerto:true}},{...r,answer:{...r.answer,multiplos_atos:true}}])
    assert.notEqual(decideV6(p,changed).decision,'aceito');
  assert.equal(decideV6({eligible:false,reason:'sem_texto'},r).decision,'pendente');
});
test('v6 processo sem resultado no segmento não vira descarte por ausência de prova',()=>{
  const p=real('4ad8ed86'),s=p.segments.find(x=>x.process==='1210770');
  const child=prepareProcess(p,s),old=initial.results.find(x=>x.id.startsWith('4ad8ed86')).children.find(x=>x.process==='1210770');
  assert.ok(child.segmentLimitation);assert.equal(old.proposal.decision,'descartado');
  assert.equal(decideV6(child,old.review).reason,'segmento_sem_resultado_exige_documento_primario');
  assert.equal(decideV6(child,old.review).decision,'pendente');
});
