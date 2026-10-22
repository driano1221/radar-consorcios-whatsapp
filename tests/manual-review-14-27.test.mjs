import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {classifyItem} from '../src/lib/classifier.mjs';
import {documentaryCorrection} from '../src/lib/documentary-corrections.mjs';
import {decideSimpleTriage,categoryGroup,loadOriginalTriage} from '../src/lib/simple-triage.mjs';
import {loadEditorialGuard,applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';
import {buildDashboardData} from '../scripts/build-dashboard.mjs';
import {newsRecord,newsCsv} from '../dashboard/src/news-view.mjs';
const directory=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
const read=async name=>(await readFile(`${directory}/${name}.ndjson`,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const hash=value=>createHash('sha256').update(value).digest('hex');
const classify=(title,rawText)=>{
 const item={kind:'gazette',title,rawText,url:'https://fonte.exemplo/ato'};
 const classification=classifyItem(item);
 return {classification,triage:decideSimpleTriage({...item,classification})};
};

test('dispensa publicada para serviço de consórcio confirma somente a autorização intermunicipal',()=>{
 const body='O Município de Azul torna público que foi efetuado o Processo de Dispensa de Licitação nº 101/2026, conforme Processo Administrativo Digital nº 2.332/2026, com base no artigo 75, inciso XI, da Lei Federal 14.133/2021, visando a CONTRATACAO DO CONSISA PARA PRESTAÇÃO DE SERVIÇOS NA ÁREA DE ENGENHARIA: ENGENHARIA MECÂNICA. A contratação será realizada com o CONSORCIO INTERMUNICIPAL DE SERVICOS DO VALE DO RIO TAQUARI, inscrito no CNPJ 07.242.772/0001-89.';
 const current=classify('Dispensa de licitação 101/2026',body);
 assert.equal(current.classification.proofKind,'authorized_public_cooperation');
 assert.equal(current.classification.category,'COOPERAÇÃO AUTORIZADA');
 assert.equal(categoryGroup(current.triage.category),'ATUAÇÃO');assert.equal(current.triage.status,'confirmado');
 assert.match(current.triage.stage,/contrato firmado, execução e pagamento não comprovados/);
 assert.ok(body.includes(current.triage.evidence));
 for(const text of [body.replace('CONSORCIO INTERMUNICIPAL DE SERVICOS DO VALE DO RIO TAQUARI','EMPRESA DE ENGENHARIA LTDA'),
  body.replace('foi efetuado o Processo de Dispensa de Licitação','pretende realizar uma contratação futura'),
  body.replace('torna público','não torna público'),'Caso '+body,
  body.replace('artigo 75, inciso XI','artigo 75, inciso II'),
  'O consórcio divulgará um edital para serviços futuros. A Prefeitura de Azul pretende estudar uma contratação, ainda sem processo autorizado.'])
  assert.notEqual(documentaryCorrection('Dispensa de licitação',text)?.proofKind,'authorized_public_cooperation');
 assert.notEqual(documentaryCorrection('Minuta de aviso de dispensa',body)?.proofKind,'authorized_public_cooperation');
 const preview={kind:'gazette',title:'Dispensa de licitação',summary:body,url:'https://fonte.exemplo/ato'};
 assert.notEqual(decideSimpleTriage({...preview,classification:classifyItem(preview)}).status,'confirmado');
});

test('ratifica o protocolo no artigo operativo de lei é ratificação, sem inventar constituição ou ingresso',()=>{
 const body='O Prefeito Municipal faz saber que a Câmara aprovou e sanciona a seguinte Lei. Art. 1º Ratifica o Protocolo de Intenções do Consórcio Público Ambiental dos Municípios da Serra e autoriza a celebração do contrato público. Art. 2º Esta lei entra em vigor na data de sua publicação.';
 const current=classify('LEI Nº 2.417/2024',body);
 assert.equal(current.classification.category,'PROTOCOLO');assert.equal(current.triage.status,'confirmado');
 assert.match(current.triage.stage,/ingresso homologado, constituição e rateio assinado não comprovados/);
 assert.ok(body.includes(current.triage.evidence));
 for(const [title,text] of [['PROJETO DE LEI Nº 2.417/2024',body],['LEI Nº 2.417/2024',body.replace('Ratifica o','Não ratifica o')],
  ['LEI Nº 2.417/2024',body.replace('Ratifica o','Caso ratifica o')],['LEI Nº 2.417/2024',body.replace('Ratifica o','Pretende futuramente ratificar o')]])
  assert.notEqual(documentaryCorrection(title,text)?.proofKind,'ratified_protocol');
});

test('casos 14–27 fecham com procedência, limites de OCR e relações sem apagar revisões anteriores',async()=>{
 const [archive,reviews,guard,originalDecisions]=await Promise.all([read('arquivo-coletas'),read('revisoes-eventos'),loadEditorialGuard(directory),loadOriginalTriage(directory)]);
 const batch=reviews.filter(r=>r.lote_retroativo==='revisao-manual-14-27-2026-10-22');
 const byCase=new Map(batch.map(r=>[r.caso_lista_manual,r]));
 const cases=[...byCase.values()].filter(r=>r.caso_lista_manual>=14);
 assert.deepEqual(cases.map(r=>r.caso_lista_manual),[14,15,16,17,18,19,20,21,22,23,24,25,26,27]);
 assert.deepEqual(cases.filter(r=>r.decisao==='confirmar_evento').map(r=>r.caso_lista_manual),[17,23]);
 for(const r of cases){
  const row=archive.find(a=>a.id===r.documento_id);
  assert.equal(hash(row.trecho||''),r.trecho_sha256);assert.equal(hash(r.leitura_usuario.relato),r.leitura_usuario.relato_sha256);
  assert.equal(r.texto_evidencia_sha256,undefined,'Relato/OCR do usuário ou aviso de uma página não é íntegra recuperada');
  assert.deepEqual(r.checks,[]);
 }
 assert.equal(byCase.get(15).leitura_usuario.ocr,true);assert.match(byCase.get(15).leitura_usuario.qualidade_ocr,/baixa/);
 assert.deepEqual(byCase.get(15).verificacoes_assistente.map(v=>v.pagina),[1,51]);
 assert.equal(byCase.get(16).fatos.uf,'SP');assert.match(byCase.get(16).etapa,/assembleia futura/);
 assert.equal(byCase.get(17).fatos.ano,2024);assert.equal(byCase.get(17).data_fato,'2024-06-21');
 assert.equal(byCase.get(17).fatos.data_publicacao_nao_comprovada,true);
 assert.match(byCase.get(17).motivo,/HTTP 403/);assert.match(byCase.get(23).etapa,/execução e pagamento não comprovados/);
 assert.equal(byCase.get(23).verificacoes_assistente[0].pagina,4);
 assert.equal(byCase.get(5).fatos.uf,'RS');assert.match(byCase.get(5).fatos.consorcio,/Vale do Taquari/);
 assert.equal(byCase.get(25).documento_relacionado,byCase.get(10).documento_id);
 assert.equal(byCase.get(10).documento_relacionado,byCase.get(25).documento_id);
 assert.equal(byCase.get(27).documento_relacionado,byCase.get(26).documento_id);
 for(const n of [10,25,26,27])assert.equal(byCase.get(n).decisao,'nao_evento');
 assert.match(byCase.get(26).motivo,/outra data, não prova sozinho uma publicação idêntica/);
 for(const n of [5,10]){
  const old=reviews.find(r=>r.caso_lista_manual===n&&r.lote_retroativo==='revisao-manual-3-13-2026-10-22');
  assert.equal(byCase.get(n).revisao_anterior_em,old.revisado_em);
 }
 for(const r of batch){
  assert.equal(r.publicar,false);assert.equal(r.incluir_resumo,false);
  for(const url of r.urls_documento)assert.equal(isNotifiable(applyEditorialGuard({url,classification:{category:'ATUAÇÃO',score:99}},guard)),false);
 }
 const lastById=new Map(reviews.map(r=>[r.documento_id,r]));
 const manual=[...lastById.values()].filter(r=>r.caso_lista_manual>=3&&r.caso_lista_manual<=27);
 assert.equal(manual.length,25);assert.equal(manual.filter(r=>r.decisao==='confirmar_evento').length,4);
 const ids=new Set(manual.map(r=>r.documento_id));
 const data=buildDashboardData({archive:archive.filter(r=>ids.has(r.id)),events:[],consortia:[],links:[],pendingIdentity:[],editorialReviews:reviews,originalDecisions});
 for(const item of data.items){
  assert.equal(newsRecord(item).decision,lastById.get(item.id).decisao==='confirmar_evento'?'Confirmada':'Rejeitada');
  assert.deepEqual(item.reviewChecks,[]);
 }
 assert.doesNotMatch(newsCsv(data.items),/Revisar comigo|Em processamento automático/);
 const protocol=newsRecord(data.items.find(i=>i.id===byCase.get(17).documento_id));
 assert.equal(protocol.publication,'');
 for(const prefix of ['1bc1d2cd2108','4a51b6537e62']){
  const decision=[...originalDecisions.values()].find(d=>d.documentId.startsWith(prefix));
  assert.equal(decision.status,'confirmado');assert.equal(decision.method,'inferencia_autorizada_pelo_usuario');
 }
});
