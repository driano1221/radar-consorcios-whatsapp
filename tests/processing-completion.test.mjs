import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {classifyItem} from '../src/lib/classifier.mjs';
import {applySimpleTriage,TRIAGE_VERSION} from '../src/lib/simple-triage.mjs';
import {catalogRecord,mergeCatalogRecord} from '../src/lib/catalog.mjs';
import {persistArticleTexts} from '../src/lib/article-text-store.mjs';
import {upgradeLegacyTriage} from '../scripts/reprocess-triage.mjs';
import {enrichArticle} from '../src/lib/article-enrichment.mjs';
import {recoveryAttempt,recoveryDue} from '../src/lib/recovery-policy.mjs';
import {locateQuote} from '../src/lib/quote-evidence.mjs';
import {loadOriginalTriage,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {loadEditorialGuard,applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';
const decide=(title,rawText,extra={})=>applySimpleTriage({title,rawText,kind:'gazette',url:'https://diario.exemplo/ato',
  classification:classifyItem({title,rawText,kind:'gazette'}),...extra});

test('coluna com assuntos mistos confirma só a contestação eleitoral relatada, sem nova criação',()=>{
  const rawText='Eleição da Câmara Municipal em outra cidade. Novo consórcio: a prefeita afirmou estar articulando a criação de um novo consórcio público, após divergências sobre as regras da eleição do Cimpajeú. A gestora também informou que recorreu à Justiça para contestar a restrição ao seu direito de voto na escolha da próxima diretoria da entidade. Outros assuntos e agendas da coluna.';
  const i=decide('Coluna do Finfa',rawText,{kind:'news'});
  assert.equal(i.triage.status,'confirmado');assert.equal(i.triage.category,'CRISE');
  assert.match(i.triage.stage,/decisão judicial e novo consórcio não comprovados/);
  assert.ok(rawText.includes(i.triage.evidence));
});

test('prova em anexo longo mantém caracteres exatos, limites de palavra e tipografia',()=>{
  const quote='Esta Lei estima a Receita e fixa a Despesa';
  assert.equal(locateQuote(quote,['Contexto '.repeat(100000)+quote+'. Anexos finais.']),quote);
  assert.equal(locateQuote('Aprovou o contrato público',['Texto '.repeat(50000)+'APROVOU: O CONTRATO PÚBLICO.']),'APROVOU: O CONTRATO PÚBLICO');
  assert.equal(locateQuote('ato de rateio',['formato de rateio municipal']), '');
});

test('extrato assinado de rateio prevalece sobre ratificação e participação citadas nos fundamentos',()=>{
  const body='EXTRATO DO CONTRATO DE RATEIO Nº 2026027/001. PARTES: Consórcio Intermunicipal Público e Município de Azul. OBJETO: repasses financeiros. FUNDAMENTO: leis de ratificação do Protocolo de Intenções e adesão municipal. VALOR: R$ 500,00. DATA DA ASSINATURA: 22 de outubro de 2026. SIGNATÁRIOS: prefeito e presidente.';
  const item=decide('EXTRATO DO CONTRATO DE RATEIO Nº 2026027/001',body);
  assert.equal(item.triage.status,'confirmado');assert.equal(item.triage.category,'RATEIO');
  assert.match(item.triage.stage,/não comprova pagamento ou novo ingresso/);
  assert.notEqual(decide('MINUTA DO CONTRATO DE RATEIO',body).triage.status,'confirmado');
});

test('ato operativo distingue comissão de apuração e julgamento de mera nomeação de fiscal',()=>{
  const cases=[
    ['PORTARIA Nº 706','O Município de Azul RESOLVE: Art.1º Designar os servidores como responsáveis pela fiscalização e controle do contrato abaixo. Contrato de Rateio 001/2026. Consórcio Intermunicipal de Saúde. Esta portaria substitui a designação anterior.','descartado','GERAL'],
    ['PORTARIA Nº 392','O Prefeito RESOLVE: Art. 1º Designar os servidores para avaliarem se há ou não dívida pendente junto ao Consórcio Público da Serra. Art. 2º A comissão terá quinze dias para concluir a avaliação, sem reconhecimento prévio da dívida.','confirmado','CONTROLE'],
    ['TCE confirma suspensão por consórcio intermunicipal','O Tribunal de Contas do Estado (TCE/RN) confirmou a suspensão do Pregão do Consórcio Intermunicipal de Saúde. A decisão foi aprovada pela Câmara. A cautelar não representa condenação definitiva do consórcio.','confirmado','CONTROLE'],
  ];
  for(const [title,body,status,category]of cases){const item=decide(title,body);assert.equal(item.triage.status,status,title);assert.equal(item.triage.category,category,title);assert.ok(body.includes(item.triage.evidence));}
  const negative=decide('Possível suspensão de consórcio intermunicipal','O Tribunal de Contas do Estado não confirmou a suspensão do Pregão do Consórcio Intermunicipal de Saúde. O pedido segue em análise e não existe decisão sobre o procedimento. Nenhuma suspensão foi determinada.');
  assert.notEqual(negative.triage.method,'regra_documental_especifica');
});

test('diárias e convênio de saída não são retirada de município; cadastro no TCE não é fiscalização',()=>{
  for(const [title,body]of [
    ['AUTORIZA A CONCESSÃO DE DIÁRIAS DE VIAGEM','O Presidente do Consórcio Intermunicipal RESOLVE: Art. 1º Autorizar a concessão de diárias de viagem ao agente para participar de seminário. Data de saída: 25/10/2026. Data de retorno: 26/10/2026. Não há desligamento municipal.'],
    ['RETIFICAÇÃO DO EXTRATO DO CONTRATO Nº 93','O Município retifica o Convênio de Saída nº 123/2026 com o Consórcio Intermunicipal. Onde se lê o nome antigo, leia-se o nome corrigido. Permanecem inalteradas as demais informações constantes da publicação original.'],
    ['TERMO DE RETIFICAÇÃO E RATIFICAÇÃO','O Consórcio Intermunicipal informa: A presente retificação limita-se à inclusão do identificador de registro perante o Tribunal de Contas, sem alteração do objeto do edital. O registro e-Sfinge não traz julgamento ou sanção.'],
  ])assert.equal(decide(title,body).triage.status,'descartado',title);
});

test('participação ad referendum não vira homologação e eleição futura não vira resultado',()=>{
  const provisional=decide('DECISÃO ADMINISTRATIVA','O PRESIDENTE DO CONSÓRCIO INTERMUNICIPAL DE SAÚDE DECIDE AUTORIZAR, em caráter ad referendum do Colegiado de Prefeitos, a adesão do Município de Azul ao Consórcio de Saúde. Esta decisão será submetida à homologação na próxima assembleia.');
  assert.equal(provisional.triage.category,'ADESÃO AUTORIZADA');assert.equal(provisional.triage.status,'confirmado');assert.match(provisional.triage.stage,/homologação.*pendente/);
  const future=decide('Convocação eleitoral','O Consórcio Intermunicipal de Saúde convoca assembleia que será realizada em novembro. A pauta inclui eleição. Caso a chapa seja eleita por aclamação, seus membros assumirão a Diretoria no próximo ano. Não houve votação.');
  assert.notEqual(future.triage.status,'confirmado');
});

test('conclusão varre pendências com o mesmo hash e versão, sem depender da fila ou modificar decisões concluídas',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'radar-conclude-'));
  try{
    const body='O Tribunal de Contas do Estado confirmou a suspensão do Pregão do Consórcio Intermunicipal de Saúde. A decisão foi aprovada pela Segunda Câmara e suspende os contratos até a apuração das irregularidades descritas no processo.';
    const source={title:'TCE confirma suspensão por consórcio intermunicipal',url:'https://diario.exemplo/tce',rawText:body,kind:'news'};
    const row=catalogRecord({...source,triage:{version:TRIAGE_VERSION,status:'processando',bodyHash:createHash('sha256').update(body).digest('hex')}},'2026-10-23','2026-10-23');
    await persistArticleTexts(dir,[{...source,articleUrl:source.url,contentProvenance:'pagina_original'}]);
    const state={pending:{},seen:{},observations:{[row.id]:{item:source}}},before=JSON.stringify(state);
    const records=new Map([[row.id,row]]);
    assert.equal(await upgradeLegacyTriage(dir,records,state),1);
    assert.equal(records.get(row.id).decisao_base,'confirmado');assert.equal(records.get(row.id).tipo_evento,'CONTROLE');
    assert.equal(await upgradeLegacyTriage(dir,records,state),0);assert.equal(JSON.stringify(state),before);
    row.triagem_automatica.status='descartado';records.set(row.id,row);
    assert.equal(await upgradeLegacyTriage(dir,records,state),0);
    row.triagem_automatica.status='processando';records.set(row.id,row);
    assert.equal(await upgradeLegacyTriage(dir,records,state,new Set([row.id])),0);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('leitor de matéria oficial aceita anexo grande íntegro e valida código, sem ampliar limite de notícias',async()=>{
  const body='LEI Nº 543. Estima a Receita e fixa a Despesa da Prefeitura Municipal. O prefeito sanciona a seguinte lei: Art. 1º Esta Lei estima a Receita e fixa a Despesa para o exercício seguinte.';
  const html=`<title>Lei</title><!--${'x'.repeat(2_100_000)}--><article><div id="materia">${body}</div><span class="verificacao__codigo">6EC4A10D</span><dl class="verificacao__dados"><dt>Publicada em</dt><dd>23/10/2026</dd></dl></article>`;
  const source={kind:'news',title:'LEI MUNICIPAL Nº543',url:'https://www.diariomunicipal.com.br/femurn/materia/6EC4A10D'};
  const fetchImpl=async()=>new Response(html,{headers:{'content-type':'text/html'}});
  const r=await enrichArticle(source,{fetchImpl});assert.equal(r.rawText,body);assert.equal(r.articleReader,'sigpub_materia_original');
  const failed=[];
  const wrong=await enrichArticle({...source,url:source.url.replace('6EC4A10D','AAAAAAAA')},{fetchImpl,onFailure:(_,r)=>failed.push(r)});
  assert.equal(wrong.rawText,undefined);assert.deepEqual(failed,['sigpub_corpo_ou_identidade_invalida']);
  await enrichArticle({...source,url:'https://outro.exemplo/lei'},{fetchImpl,onFailure:(_,r)=>failed.push(r)});
  assert.equal(failed.at(-1),'pagina_grande_demais');
});

test('bloqueio tem nova tentativa limitada e verificável, nunca conclusão inventada',async()=>{
  let failure='';const source={title:'PROJETO DE LEI Nº 76',kind:'news',url:'https://camara.exemplo/76'};
  const r=await enrichArticle(source,{fetchImpl:async()=>new Response('<title>Bot Verification</title><p>Verify you are human</p>',{headers:{'content-type':'text/html'}}),onFailure:(_,reason)=>failure=reason});
  assert.equal(r,source);assert.equal(failure,'bloqueio_antibot');
  const row=recoveryAttempt({article_attempts:1,triagem_automatica:{status:'processando'}},{now:'2026-10-23T20:00:00Z',reason:failure});
  assert.equal(row.article_next_attempt_at,'2026-10-24T00:00:00.000Z');
  assert.equal(recoveryDue(row,{now:Date.parse('2026-10-23T22:00:00Z')}),false);
  assert.equal(recoveryDue(row,{now:Date.parse(row.article_next_attempt_at)}),true);
});

test('redescoberta não apaga próxima tentativa nem URL já resolvida da recuperação',()=>{
  const source={title:'PROJETO DE LEI Nº 76',url:'https://diario.exemplo/76',classification:{category:'GERAL',score:0}};
  const row=catalogRecord(source,'2026-10-22','2026-10-22');
  const attempted=recoveryAttempt({...row,triagem_automatica:{status:'processando'}},{now:'2026-10-23T20:00:00Z',reason:'bloqueio_antibot',resolvedUrl:'https://camara.exemplo/projeto76'});
  const fresh=catalogRecord({...source,triage:{version:TRIAGE_VERSION,status:'processando'}},'2026-10-23','2026-10-23');
  const merged=mergeCatalogRecord(attempted,fresh);
  assert.equal(merged.article_next_attempt_at,attempted.article_next_attempt_at);
  assert.equal(merged.article_resolved_url,attempted.article_resolved_url);
  assert.equal(merged.article_attempted_at,attempted.article_attempted_at);
  assert.equal(merged.article_recovery_reason,'bloqueio_antibot');
});

test('lote dos 26 mantém prova, decisão canônica e bloqueio de reenvio inclusive por URL resolvida',async()=>{
  const directory=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
  const audit=JSON.parse(await readFile(path.join(directory,'conclusao-pendencias-26.json'),'utf8'));
  const rows=(await readFile(path.join(directory,'arquivo-coletas.ndjson'),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  const byId=new Map(rows.map(r=>[r.id,r])),decisions=await loadOriginalTriage(directory),guard=await loadEditorialGuard(directory);
  assert.equal(audit.length,26);
  assert.equal(audit.filter(d=>d.status==='confirmado').length,12);assert.equal(audit.filter(d=>d.status==='descartado').length,13);
  for(const a of audit){
    const row=byId.get(a.id),d=decisions.get(a.id);assert.equal(d.status,a.status);assert.equal(d.category,a.category);
    assert.ok(validOriginalTriage(row,d));assert.equal(d.alertAllowed,false);assert.equal(d.weeklyAllowed,false);
    assert.ok(d.status==='processando'||d.evidence);
    for(const url of new Set([row.url,row.article_url,d.sourceUrl].filter(Boolean))){
      const i=applyEditorialGuard({url,title:row.titulo,publishedAt:'2030-01-01',classification:{category:d.category,score:99}},guard);
      assert.equal(isNotifiable(i),false,url);assert.equal(i.publicationDecision,'historico');
    }
  }
});
