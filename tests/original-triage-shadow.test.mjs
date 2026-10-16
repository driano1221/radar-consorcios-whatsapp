import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareOriginal,decideOriginal,reviewOriginal,sha,VERSION} from '../scripts/lib/original-triage-shadow.mjs';
import {refineShadow,entityProven} from '../scripts/lib/original-shadow-rules.mjs';
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
  assert.equal(input.regra,undefined);
  assert.equal(input.decisao_base,undefined);assert.equal(result.inputHash,prepared.inputHash);
});

test('shadow normaliza grafia sem inventar identidade ou aceitar sigla alheia',()=>{
  const body='CONSORCIO INTERMUNICIPAL DO VALE AZUL (CIVA) publicou a resolução com procedimentos de inspeção.';
  assert.equal(entityProven(body,'Consórcio Intermunicipal do Vale Azul',body),true);
  assert.equal(entityProven(body,'Consórcio Intermunicipal do Vale Azul (CIVA)','CONSORCIO INTERMUNICIPAL DO VALE AZUL'),true);
  assert.equal(entityProven(body,'Consórcio Intermunicipal do Vale Verde',body),false);
  assert.equal(entityProven(body,'Consórcio Intermunicipal do Vale Azul (CIVB)',body),false);
  assert.equal(entityProven(body,'CIV',body),false);
  assert.equal(entityProven(body+' O CIVA atua aqui.','Consórcio Intermunicipal do Vale Verde (CIVA)',body),false);
});
test('shadow prova literal continua exigindo citação do corpo mesmo normalizando o nome',()=>{
  const prepared=p();assert.equal(decideOriginal(prepared,review(prepared,{evidencia_entidade:text.toUpperCase()})).reason,'identidade_sem_prova_literal');
});
test('shadow distingue mural de documentos de um documento que apenas cita outras normas',()=>{
  const rule={category:'RATEIO',score:9};
  const listing={rawText:'Lista de outras publicações Foram encontradas 30 registros Contrato de rateio 01/2026 Acessar Contrato 02/2026 Acessar Contrato 03/2026 Acessar'};
  assert.equal(refineShadow(listing,rule).category,'GERAL');
  assert.equal(refineShadow({rawText:'Lei 10/2026 ratifica estatuto e cita a Lei 11.107/2005. Art. 1º Fica ratificado. Art. 2º Fica autorizado o custeio.'},rule).category,'RATEIO');
});
test('shadow ficha do acórdão não é julgamento; resultado explícito impede descarte por metadados',()=>{
  const item={title:'Detalhes do Acórdão - 22/2026',rawText:'Acórdão 22/2026 Decisão na Íntegra (PDF) Classe Processual/Assunto Contas do consórcio.'};
  const rule={category:'FINANÇAS',score:8};
  assert.equal(refineShadow(item,rule).category,'GERAL');
  assert.notEqual(refineShadow({...item,rawText:item.rawText+' O colegiado julgou regulares as contas.'},rule).category,'GERAL');
});
test('shadow fato principal prevalece sobre rodapé genérico, sem aceitar futuro ou negação',()=>{
  const base={category:'GOVERNANÇA',score:8};
  const sentence='O Consórcio Intermunicipal Vale Azul deu início à segunda fase do programa Saúde Regional. A assembleia é a instância soberana da entidade.';
  assert.equal(refineShadow({rawText:sentence},base).category,'ATUAÇÃO');
  assert.equal(refineShadow({rawText:sentence.replace('deu início','pretende dar início')},base).category,'GOVERNANÇA');
  assert.equal(refineShadow({rawText:sentence.replace('O Consórcio','Não é verdade que o Consórcio')},base).category,'GOVERNANÇA');
});
test('shadow julgamento de contas é controle; não altera negação',()=>{
  const rule={category:'FINANÇAS',score:9};
  const body='O Tribunal de Contas do Estado do Paraná reprovou as contas de 2023 do Consórcio Intermunicipal Vale Azul.';
  assert.equal(refineShadow({rawText:body},rule).category,'CONTROLE');
  assert.equal(refineShadow({rawText:body.replace('reprovou','não reprovou')},rule).category,'FINANÇAS');
});
test('shadow não promove contrato com celebração a conferir nem ignora atos independentes',()=>{
  const prepared=p();prepared.rule.stage='contrato de rateio citado; celebração a conferir';
  assert.equal(decideOriginal(prepared,review(prepared)).reason,'etapa_ou_prova_da_regra_insuficiente');
  const x=p();assert.equal(decideOriginal(x,review(x,{multiplos_atos:true,atos_independentes:['Lei 01/2026','Lei 02/2026']})).reason,'multiplos_atos');
});
test('shadow não permite IA revogar veto comprovado para mural ou requerimento',()=>{
  const body='Lista de outras publicações Foram encontradas 20 registros. Contrato de rateio 01 Acessar Contrato de rateio 02 Acessar Contrato de rateio 03 Acessar. Documentos oficiais disponíveis para consulta.';
  const prepared=prepareOriginal(row,{...stored,texto:body,texto_sha256:sha(body)});
  const result=decideOriginal(prepared,review(prepared,{categoria:'RATEIO',evidencia:body,relevante:true}));
  assert.equal(result.decision,'descartado');assert.equal(result.policyExclusion,'document_index');
  const req='Matéria: Requerimento 19/2026 Ementa: Solicita adesão do município ao consórcio público. Resultado da Votação: Aprovado. Votos Sim: 12. O sistema informa tramitação e participação dos vereadores.';
  const q=prepareOriginal(row,{...stored,texto:req,texto_sha256:sha(req)});
  assert.equal(decideOriginal(q,review(q,{relevante:true,categoria:'ADESÃO AUTORIZADA',evidencia:req})).decision,'descartado');
});
test('shadow distingue vários processos de artigos de uma mesma norma',()=>{
  const s='O tribunal analisou três processos envolvendo consórcios públicos. Um dos processos, autuado sob o número 1234567, envolve o primeiro. Outro processo (n. 7654321), envolve outra entidade. Foram decisões autônomas.';
  const prepared=prepareOriginal(row,{...stored,texto:s,texto_sha256:sha(s)});
  assert.equal(prepared.independentProcesses,true);
  assert.equal(decideOriginal(prepared,review(prepared,{multiplos_atos:false})).reason,'processos_independentes_no_corpo');
  const t='Lei 11/2026 ratifica estatuto e autoriza custeio. Art. 1º Fica ratificado. Art. 2º Fica autorizado o repasse. A Lei 11.107/2005 é a base legal. O presente texto continua sendo uma única lei municipal.';
  assert.equal(prepareOriginal(row,{...stored,texto:t,texto_sha256:sha(t)}).independentProcesses,false);
});
test('shadow rejeição concordante usa prova literal da regra, mas aceite nunca recebe esse atalho',()=>{
  const prepared=p();prepared.rule={...prepared.rule,category:'GERAL',score:0,evidenceText:text};
  const result=decideOriginal(prepared,review(prepared,{relevante:false,categoria:'IRRELEVANTE',evidencia:''}));
  assert.equal(result.decision,'descartado');assert.equal(result.evidenceOrigin,'regra_concordante');
  const yes=p();assert.equal(decideOriginal(yes,review(yes,{evidencia:''})).reason,'prova_literal_ausente');
  assert.equal(decideOriginal(prepared,review(prepared,{relevante:true,categoria:'ATUAÇÃO',evidencia:''})).reason,'prova_literal_ausente');
});
test('shadow erro de chamada não se confunde com resposta desatualizada',()=>{
  assert.equal(decideOriginal(p(),{error:'timeout'}).reason,'segunda_leitura_falhou');
});
test('shadow rateio exige instrumento publicado com fechamento, não basta citar celebração',()=>{
  const rule={category:'RATEIO',score:7,stage:'contrato de rateio citado; celebração a conferir'};
  const body='As partes resolvem celebrar o presente Contrato de Rateio, conforme cláusulas. Por estarem de acordo, assinam o presente Contrato em quatro vias. PREFEITO MUNICIPAL João. PRESIDENTE DO CONSÓRCIO José.';
  const item={kind:'gazette',title:'CONTRATO DE RATEIO 55/2026',rawText:body};
  assert.equal(refineShadow(item,rule).proofKind,'published_rateio_instrument');
  assert.equal(refineShadow({...item,rawText:'MINUTA '+body},rule).stage,rule.stage);
  assert.equal(refineShadow({...item,rawText:body.replace('assinam o presente Contrato','assinarão o instrumento')},rule).stage,rule.stage);
});
test('shadow não está ligado à produção; executor não possui modo apply',async()=>{
  for(const file of ['../src/radar.mjs','../src/lib/catalog.mjs','../src/weekly.mjs'])
    assert.doesNotMatch(await readFile(new URL(file,import.meta.url),'utf8'),/original-triage-shadow|simulate-original-triage/);
  const script=await readFile(new URL('../scripts/simulate-original-triage.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(script,/sendMessage|saveCatalog|writeState|loadEditorialGuard/);
  assert.match(script,/there is no apply mode/);
});
