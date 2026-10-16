import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {completedCourse,locateQuote,splitProcesses,prepareV5,prepareProcess,decideV5,readV5,relatedAspects,VERSION} from '../scripts/lib/original-v5.mjs';
import {sha} from '../scripts/lib/original-triage-shadow.mjs';
const texts=(await readFile(new URL('../data/catalogo/textos-artigos.ndjson',import.meta.url),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const archive=(await readFile(new URL('../data/catalogo/arquivo-coletas.ndjson',import.meta.url),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
function real(prefix){const s=texts.find(x=>x.documento_id.startsWith(prefix));return prepareV5(archive.find(x=>x.id===s.documento_id),s);}
function answer(p,a){return {version:VERSION,inputHash:p.inputHash,textHash:p.textHash,contentReviewKey:sha(VERSION+'\n'+p.item.rawText),answer:a};}

test('v5 ABC: recupera capacitação concluída sem afirmar entrega futura de certificado',()=>{
  const p=real('b187ce5d');assert.ok(p.course);assert.equal(p.rule.category,'ATUAÇÃO');
  const a={incerto:false,multiplos_atos:false,relevante:true,categoria:'ATUAÇÃO',escopo:'entidade',
    entidade:'Consórcio Intermunicipal Grande ABC',evidencia_entidade:p.course.actor,
    evidencia:p.course.training,evidencias_complementares:[p.course.completion],justificativa:'A capacitação foi realizada; os certificados serão entregues no futuro.'};
  assert.equal(decideV5(p,answer(p,a)).decision,'aceito');
  assert.equal(decideV5(p,answer(p,{...a,evidencias_complementares:[]})).reason,'curso_exige_prova_de_realizacao_e_conclusao');
  assert.equal(decideV5(p,answer(p,{...a,relevante:false,categoria:'IRRELEVANTE'})).decision,'pendente');
});
test('v5 curso: futuros, negações, notícia relacionada e presença passiva não qualificam',()=>{
  const body=real('b187ce5d').item.rawText;
  for(const edited of [body.replace('foi promovida','será promovida'),body.replace('foi promovida','não foi promovida'),
    body.replace('concluíram o curso','concluirão o curso'),body.replace('que concluíram','que não concluíram'),
    body.replace('realiza,','participará de,'),body.replace('A capacitação','LEIA TAMBÉM: A capacitação')])
    assert.equal(completedCourse(edited),null);
});
test('v5 curso: variação de entidade e formulação, não exceção por ID',()=>{
  const body=real('b187ce5d').item.rawText.replaceAll('Grande ABC','Vale Azul').replaceAll('capacitação','formação').replace('foi promovida','foi realizada');
  assert.ok(completedCourse(body));
});
test('v5 citação: troca de caixa recupera trecho real e posições exatas',()=>{
  const p=real('b45f5ada');
  const quote='O Consórcio Intermunicipal Multifinalitário - CIS-VERDE publicou um edital de Processo Seletivo Simplificado visando preencher uma vaga e formar cadastro de reserva para o cargo de Assistente Administrativo de nível médio.';
  const found=locateQuote(p.item.rawText,quote);
  assert.ok(found.text.startsWith('o Consórcio'));assert.equal(p.item.rawText.slice(found.start,found.end),found.text);
  const a={incerto:false,multiplos_atos:false,relevante:false,categoria:'IRRELEVANTE',evidencia:quote,
    justificativa:'Seleção administrativa sem outro fato institucional.',escopo:'fora_escopo'};
  const result=decideV5(p,answer(p,a));assert.equal(result.decision,'descartado');
  assert.equal(result.evidence,found.text);assert.equal(result.modelEvidence,quote);
});
test('v5 citação: não aceita números alterados, paráfrase, acento removido nem ambiguidade',()=>{
  const q='O consórcio realizou 100 procedimentos oftalmológicos.';
  for(const change of [q.replace('100','200'),q.replace('realizou','promoveu'),q.replace('consórcio','consorcio')])assert.equal(locateQuote(q,change),null);
  assert.equal(locateQuote(q+' '+q,q),null);
  assert.equal(locateQuote(q,'muito curto'),null);
  assert.equal(locateQuote(q,'(?s).*'),null);
});
test('v5 citação: nova política exige versão e hash, não reutiliza leitura antiga silenciosamente',()=>{
  const p=real('b45f5ada');assert.equal(decideV5(p,{version:'original-shadow-3.1'}).reason,'segunda_leitura_desatualizada');
  assert.equal(decideV5(p,{error:'timeout'}).decision,'pendente');
});
test('v5 exclusão determinística de índice não depende de resposta válida da IA',()=>{
  const p=real('a1c44476');
  assert.equal(decideV5(p,{error:'JSON inválido'}).decision,'descartado');
  assert.equal(decideV5(p).reading,'explicit_existing_policy');
});
test('v5 TCE: dois processos, anexo não é terceiro processo, spans íntegros sem sobreposição',()=>{
  const p=real('79480ee3');assert.equal(p.segments.length,2);
  assert.deepEqual(p.segments.map(s=>s.process),['1214503','1210634']);
  assert.deepEqual(p.segments[0].annexes,['1217850']);
  for(const s of p.segments)assert.equal(p.item.rawText.slice(s.start,s.end),s.text);
  assert.ok(p.segments[0].end<=p.segments[1].start);
  assert.equal(decideV5(p).decision,'desdobrar');
  for(const s of p.segments){const child=prepareProcess(p,s);assert.equal(child.rule.category,'CONTROLE');assert.ok(child.rule.stage.includes('provisória'));assert.equal(child.parentTextHash,p.textHash);}
  assert.ok(!p.segments[0].text.includes('1210634'));assert.ok(!p.segments[1].text.includes('1.214.503'));
});
test('v5 TCE: um processo com anexo, mesma referência repetida e lei multiartigo não são dois fatos',()=>{
  const p=real('79480ee3');assert.equal(splitProcesses(p.segments[0].text).length,0);
  assert.equal(splitProcesses(p.item.rawText.replace('1.210.634','1.214.503')).length,0);
  assert.equal(splitProcesses('Lei 15/2026. Artigo 1º autoriza o ingresso. Artigo 2º ratifica estatuto.').length,0);
});
test('v5 TCE: números renomeados funcionam; não são exceções por ID de registro',()=>{
  const body=real('79480ee3').item.rawText.replaceAll('1.214.503','2.345.678').replaceAll('1.210.634','2.345.679');
  assert.deepEqual(splitProcesses(body).map(s=>s.process),['2345678','2345679']);
});
test('v5 TCE: prova de outro processo não pode confirmar segmento',()=>{
  const p=real('79480ee3'),c=prepareProcess(p,p.segments[0]);
  const a={incerto:false,multiplos_atos:false,relevante:true,categoria:'CONTROLE',escopo:'entidade',
    evidencia:'Gilberto Diniz determinou a suspensão dos efeitos futuros das Atas de Registro de Preços nºs 23/2026 e 24/2026',
    justificativa:'Suspensão de ata confirmada pelo colegiado.',entidade:'Ciminas',evidencia_entidade:'Consórcio Interfederativo de Minas Gerais (Ciminas)'};
  assert.equal(decideV5(c,answer(c,a)).reason,'prova_literal_ausente');
});
test('v5 API: corpo inteiro ou segmento explícito, sem decisão esperada e versão de prompt própria',async()=>{
  const p=real('b187ce5d');let payload;
  const r=await readV5(p,{apiKey:'test-only',fetchImpl:async(u,o)=>{payload=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}));}});
  assert.equal(r.version,VERSION);assert.equal(JSON.parse(payload.messages[1].content).corpo,p.item.rawText);
  assert.match(payload.messages[0].content,/completed course/);
  assert.deepEqual(Object.keys(JSON.parse(payload.messages[1].content)),['corpo']);
});
test('v5 mesma lei: ingresso e custeio são aspectos, duas leis ou entidades diferentes não',()=>{
  const p=real('ac59dad5'),body=p.item.rawText;
  const name='Consórcio Intermunicipal de Desenvolvimento Econômico, Social e Ambiental – Norte Araguaia (CIDESA-NA)';
  const q1=body.slice(body.indexOf('Art. 1º'),body.indexOf('Art. 2º')).trim();
  const q2=body.slice(body.indexOf('Art. 2º'),body.indexOf('Art. 3º')).trim();
  const a={multiplos_atos:true,categoria:'ADESÃO AUTORIZADA',entidade:name,atos_independentes:[q1,q2]};
  assert.equal(relatedAspects(p,a).kind,'artigos_da_mesma_lei');
  assert.equal(relatedAspects({...p,item:{...p.item,rawText:body+' Lei seguinte. Art. 1º outra disposição.'}},a),null);
  assert.equal(relatedAspects(p,{...a,entidade:'Consórcio Público Inventado'}),null);
  assert.equal(relatedAspects({...p,independentProcesses:true},a),null);
});
test('v5 audiência: alternativas de regularização não viram três atos nem dissolução',()=>{
  const p=real('30f0fad5'),b=p.item.rawText;
  const q1=b.slice(b.indexOf('Ao final da audiência'),b.indexOf(' O documento estabelece'));
  const q2=b.slice(b.indexOf('Durante a reunião'),b.indexOf(' O Ministério Público ressaltou'));
  const a={multiplos_atos:true,categoria:'CONTROLE',tipo_fato:'recomendacao_entregue',atos_independentes:[q1,q2]};
  assert.equal(relatedAspects(p,a).kind,'alternativas_discutidas_na_mesma_audiencia');
  assert.equal(relatedAspects({...p,item:{...p.item,rawText:b+' Outra audiência foi realizada.'}},a),null);
  assert.equal(relatedAspects({...p,item:{...p.item,rawText:b+' Recomendação nº 24/2026 foi entregue.'}},a),null);
});
test('v5 decisão do usuário: aprovação técnica de manutenção não é atuação executada',()=>{
  const p=real('10ed23f6');assert.equal(p.rule.policyExclusion,'routine_technical_project');
  assert.equal(decideV5(p).decision,'descartado');
  const r=archive.find(x=>x.id.startsWith('10ed23f6')),s=texts.find(x=>x.documento_id===r.id);
  for(const extra of [' Obras concluídas foram entregues.', ' Alteração do estatuto aprovada.', ' Consórcio formado pelos municípios de Azul e Verde.']){
    const body=s.texto+extra;
    assert.notEqual(prepareV5(r,{...s,texto:body,texto_sha256:sha(body)}).rule.policyExclusion,'routine_technical_project');
  }
});
