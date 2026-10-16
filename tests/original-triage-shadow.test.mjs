import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareOriginal,decideOriginal,reviewOriginal,sha,VERSION} from '../scripts/lib/original-triage-shadow.mjs';
const text='O Consórcio Intermunicipal Grande ABC realizou, em 18/9, visita técnica para conhecer o simulador. O encontro foi conduzido pelo próprio consórcio com os representantes municipais, sem contratação de equipamento ou treinamento já realizado.';
const row={id:'example',titulo:'Visita realizada',url:'https://example.org/noticia',fonte:'Portal público'};
const stored={documento_id:row.id,url_original:row.url,url_artigo:row.url,leitor:'readability',texto:text,texto_sha256:sha(text)};
const p=()=>prepareOriginal(row,stored);
const answer={incerto:false,multiplos_atos:false,relevante:true,categoria:'ATUAÇÃO',evidencia:text.slice(0,108),
  justificativa:'Visita técnica efetivamente realizada, sem comprovação de contratação.',escopo:'entidade',
  entidade:'Consórcio Intermunicipal Grande ABC',evidencia_entidade:text.slice(0,108)};
const review=(prepared,override={})=>({version:VERSION,inputHash:prepared.inputHash,textHash:prepared.textHash,answer:{...answer,...override}});

test('shadow usa apenas fonte/texto original, sem decisão ou identidade editorial',()=>{
  const clean=p();const poisoned=prepareOriginal({...row,consorcio:'Entidade inventada',tipo_evento:'CRIAÇÃO',
    decisao_base:'confirmado',editorialFacts:{},titulo_revisado:'Outro título'},stored);
  assert.equal(poisoned.inputHash,clean.inputHash);
  assert.deepEqual(poisoned.rule,clean.rule);
  assert.equal(clean.rule.category,'ATUAÇÃO');
});
test('shadow aceita prova literal concordante, preservando etapa',()=>{
  const prepared=p();const decision=decideOriginal(prepared,review(prepared));
  assert.equal(decision.decision,'aceito');assert.equal(decision.category,'ATUAÇÃO');
  assert.equal(decision.stage,prepared.rule.stage);
});
test('shadow bloqueia texto ausente, adulterado, alternativo, PDF e truncamento',()=>{
  assert.equal(prepareOriginal(row).reason,'sem_integra_armazenada');
  assert.equal(prepareOriginal(row,{...stored,texto:'alterado'}).reason,'integridade_invalida');
  assert.equal(prepareOriginal(row,{...stored,leitor:'readability_reproducao_identificada'}).reason,'reproducao_nao_e_original');
  assert.equal(prepareOriginal(row,{...stored,leitor:'pypdf por página'}).reason,'pdf_exige_validacao_por_ato_e_pagina');
  const long=text.repeat(200);assert.equal(prepareOriginal(row,{...stored,texto:long,texto_sha256:sha(long)}).reason,'texto_acima_do_limite_sem_truncar');
});
test('shadow não aproveita IA antiga, inventada, divergente ou só com prova no título',()=>{
  const prepared=p();
  assert.equal(decideOriginal(prepared).reason,'segunda_leitura_nao_executada');
  assert.equal(decideOriginal(prepared,{...review(prepared),inputHash:'antigo'}).reason,'segunda_leitura_desatualizada');
  assert.equal(decideOriginal(prepared,review(prepared,{evidencia:'Um acontecimento que não existe no corpo do documento'})).reason,'prova_literal_ausente');
  assert.equal(decideOriginal(prepared,review(prepared,{categoria:'CRIAÇÃO'})).reason,'divergencia_regra_ia');
  assert.equal(decideOriginal(prepared,review(prepared,{entidade:'Prefeitura inventada'})).reason,'identidade_sem_prova_literal');
  assert.equal(decideOriginal(prepared,review(prepared,{multiplos_atos:true})).reason,'multiplos_atos');
});
test('shadow distingue base histórica de novidade para alerta sem mudar classificador',()=>{
  const s={...stored,texto:'Lei Municipal nº 352/2022. Fica autorizado o ingresso do Município de Santa Inês no Consórcio Público Intermunicipal de Saúde da Região do Vale do Piancó (CISVAP). Esta lei entra em vigor na data de sua publicação.'};s.texto_sha256=sha(s.texto);
  const prepared=prepareOriginal({...row,titulo:'Lei nº 352/2022',data_publicacao:'2026-10-16'},s);
  assert.equal(prepared.legacy.category,'GERAL');
  assert.notEqual(prepared.rule.category,'GERAL');
  // The legacy rule still misses the precise authorization stage in this
  // wording. Removing an alert-age filter must NOT authorize base promotion.
  const a={...answer,categoria:prepared.rule.category,evidencia:s.texto,entidade:'CISVAP',evidencia_entidade:s.texto};
  assert.equal(decideOriginal(prepared,review(prepared,a)).reason,'etapa_ou_prova_da_regra_insuficiente');
});
test('shadow API recebe corpo completo e não decisões humanas, nem trecho truncado',async()=>{
  const prepared=p();let payload;
  const result=await reviewOriginal(prepared,{apiKey:'test-only',fetchImpl:async(url,opts)=>{
    assert.equal(url,'https://api.deepseek.com/chat/completions');payload=JSON.parse(opts.body);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}]}),{status:200});
  }});
  const input=JSON.parse(payload.messages[1].content);assert.equal(input.corpo,text);
  assert.equal(input.decisao_base,undefined);assert.equal(result.inputHash,prepared.inputHash);
});
test('shadow não está ligado à produção; executor não possui modo apply',async()=>{
  for(const file of ['../src/radar.mjs','../src/lib/catalog.mjs','../src/weekly.mjs'])
    assert.doesNotMatch(await readFile(new URL(file,import.meta.url),'utf8'),/original-triage-shadow|simulate-original-triage/);
  const script=await readFile(new URL('../scripts/simulate-original-triage.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(script,/sendMessage|saveCatalog|writeState|loadEditorialGuard/);
  assert.match(script,/there is no apply mode/);
});
