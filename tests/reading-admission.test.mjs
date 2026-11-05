import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {readingAdmission,validReadingAdmission} from '../src/lib/reading-admission.mjs';
import {isRecoveryLead,recoveryDue} from '../src/lib/recovery-policy.mjs';
import {rowFingerprint,validOriginalTriage,decideSimpleTriage} from '../src/lib/simple-triage.mjs';
import {reprocessTriage} from '../scripts/reprocess-triage.mjs';
import {bulletinLaw} from '../src/lib/bulletin-law.mjs';
import {mergeCatalogRecord} from '../src/lib/catalog.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const row={id:'fixture',url:'https://publico.gov.br/noticia/1',titulo:'Notícia de consórcio',trecho:'',
  decisao_base:'processando',article_attempts:3,article_attempted_at:'2026-11-01T12:00:00Z',article_recovery_reason:'http_403'};

test('admissibilidade encerra falha persistente real, sem chamar isso de julgamento de conteúdo',()=>{
  const admission=readingAdmission(row);
  assert.ok(validReadingAdmission(row,admission));
  assert.equal(validReadingAdmission(row,{...admission,attempts:100}),false);
  assert.equal(readingAdmission({...row,article_attempts:2}),null);
  assert.equal(readingAdmission({...row,article_recovery_reason:'timeout'}),null);
  assert.ok(readingAdmission({...row,article_attempts:1,article_recovery_reason:'url_invalida'}));
  assert.ok(readingAdmission({...row,article_attempts:1,article_recovery_reason:'destino_nao_html'}));
  assert.equal(readingAdmission({...row,article_attempts:1,article_recovery_reason:'destino_pdf'}),null);
  assert.equal(readingAdmission({...row,article_text_sha256:sha('íntegra')}),null);
  assert.equal(readingAdmission({...row,decisao_base:'confirmado'}),null);
  assert.equal(isRecoveryLead(row),false);assert.equal(recoveryDue(row),false);
  assert.equal(recoveryDue(row,{force:true}),true);
  const human=decideSimpleTriage({editorialDecision:'confirmar_evento',classification:{category:'ATUAÇÃO'},readingAdmission:admission});
  assert.equal(human.status,'confirmado');assert.equal(human.method,'revisao_documental');
});

test('falha transitória não é bloqueio permanente: suspende apenas após orçamento real de cinco tentativas',()=>{
 assert.equal(readingAdmission({...row,article_attempts:3,article_recovery_reason:'erro: fetch failed'}),null);
 const admission=readingAdmission({...row,article_attempts:5,article_recovery_reason:'erro: fetch failed'});
 assert.ok(validReadingAdmission(row,admission));
 const decision=decideSimpleTriage({rawText:'',classification:{category:'PROTOCOLO'},readingAdmission:admission});
 assert.match(decision.reason,/não afirma bloqueio permanente/);assert.equal(decision.status,'descartado');
 assert.equal(decision.decisionBasis,'admissibilidade');assert.equal(decision.evidence,'');
});

test('código novo de erro também tem desfecho finito, enquanto encaminhamento PDF não é falsa tentativa de leitura PDF',()=>{
 for(const failure of ['http_503','google_news_nao_resolvido','cimcero_api_corpo_invalido','texto_ausente_ou_curto']){
  assert.equal(readingAdmission({...row,article_attempts:4,article_recovery_reason:failure}),null);
  const d=readingAdmission({...row,article_attempts:5,article_recovery_reason:failure});
  assert.ok(d);assert.ok(validReadingAdmission({...row,article_recovery_reason:failure},d));
 }
 assert.equal(readingAdmission({...row,article_attempts:9,article_recovery_reason:'destino_pdf'}),null);
 assert.ok(readingAdmission({...row,article_attempts:1,article_recovery_reason:'pagina_grande_demais'}));
});

test('processamento chega à decisão de entrada; só íntegra nova válida permite reanálise e decisões humanas permanecem',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'radar-admission-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const write=(name,rows)=>writeFile(path.join(dir,name+'.ndjson'),rows.map(JSON.stringify).join('\n')+'\n');
  const previous={version:4,documentId:row.id,rowHash:rowFingerprint(row),status:'processando',retroactive:true,reason:'recuperar',bodyHash:sha('')};
  await write('arquivo-coletas',[row]);await write('triagem-reprocessada',[previous]);
  const [decision]=await reprocessTriage(dir,{apply:true});
  assert.equal(decision.status,'descartado');assert.equal(decision.decisionBasis,'admissibilidade');
  assert.equal(decision.evidence,'');assert.equal(decision.nextAction,undefined);
  assert.equal(decision.alertAllowed,false);assert.equal(decision.weeklyAllowed,false);
  assert.ok(validOriginalTriage(row,decision));
  assert.equal(validOriginalTriage(row,{...decision,method:'regra_com_prova'}),false);
  const merged=mergeCatalogRecord({...row,decisao_base:'descartado',triagem_automatica:decision},
    {...row,triagem_automatica:{...previous,nextAction:'recuperar_texto'}});
  assert.equal(merged.triagem_automatica.method,'barreira_de_leitura');assert.equal(recoveryDue(merged),false);
  assert.deepEqual(await reprocessTriage(dir),[]);
  const texto='O documento apresenta somente o calendário de atendimento administrativo da entidade. Não registra deliberação institucional nem identifica outro fato novo relacionado a consórcios públicos. '.repeat(2);
  await write('textos-artigos',[{documento_id:row.id,texto,texto_sha256:sha(texto),url_artigo:row.url}]);
  const [readmitted]=await reprocessTriage(dir);
  assert.notEqual(readmitted.method,'barreira_de_leitura');assert.equal(readmitted.bodyHash,sha(texto));
  await write('revisoes-eventos',[{documento_id:row.id}]);
  assert.deepEqual(await reprocessTriage(dir,{ids:[row.id]}),[{documentId:row.id,preserved:true}]);
});

test('boletim seleciona a lei exata e integral; não mistura atos nem aceita recorte incompleto',()=>{
  const text='LEI Nº 4.696, DE 18 DE OUTUBRO DE 2023\nPrefeitura Municipal de Itanhaém. Eu promulgo.\nArt. 1º Fica ratificada a resolução do consórcio.\nArt. 2º Esta lei entra em vigor.\nProjeto de Lei de autoria do Executivo.\nPublicidade sem relação.';
  const scope={number:4696,year:2023,municipality:'Itanhaém'},pages=[{pagina:10,texto:text}];
  const unit=bulletinLaw(pages,scope);assert.equal(unit.page,10);assert.ok(!unit.text.includes('Publicidade'));
  assert.throws(()=>bulletinLaw(pages,{...scope,number:4697}));
  assert.throws(()=>bulletinLaw([...pages,...pages],scope));
  assert.throws(()=>bulletinLaw([{pagina:10,texto:text.replace('Projeto de Lei de autoria do Executivo.','')}],scope));
});
