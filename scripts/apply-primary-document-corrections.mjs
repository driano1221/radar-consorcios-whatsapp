// Approved retrospective correction only. No collector, AI or WhatsApp imports.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, cp, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { documentActId } from '../src/lib/document-acts.mjs';

export const BATCH = 'documentos-primarios-2026-10-16';
export const IDS = {
  div: '530064fc2d70255f4f1b0ee400c031c573cfff7bb5dc4b967d00c24059cd72f8',
  duplicate: 'da010f900d60f2edee35e5151ab13260b9486ca9ce01e0e88e1622c701efcf5b',
  tce: '4ad8ed86afff62415f567e581f9ada381c052197f6ced2cc025f0bdcb085bba1',
};
export const PROCESSES = ['1214381', '1210770', '1217968'];
export const actKey = n => `tce-mg-${n}-2026-09-29`;
export const actId = n => documentActId(IDS.tce, actKey(n));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const rows = async (dir, name) => (await readFile(path.join(dir, name), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeRows = (dir, name, values) => writeFile(path.join(dir, name), values.map(JSON.stringify).join('\n')+'\n');
const noSend = 'Revisão retroativa autorizada somente para a base e o painel; não reenviar no WhatsApp nem no resumo semanal.';
export const DIVERGENCE = {
  noticia: 'A notícia informa processo 1217068 e Consórcio Público para o Desenvolvimento do Alto Paraopeba (Consane).',
  documento: 'O acórdão informa processo 1217968 e Consórcio Regional de Saneamento Básico (CONSANE).',
  criterio: 'Vínculo editorial pela mesma sessão de 29/09/2026, relator Adonias Monteiro, sigla e referendo. Não há correspondência exata do número nem errata oficial localizada. O ato é comprovado pelo acórdão; o original permanece preservado.',
};
const expected = {
  'divinopolis-lei-9770.pdf': 'b4e8dd1ce090d93cd6d2d6446ed931e9f7b1380429cc45ff14f7798029ff1a9c',
  'divinopolis-publicacao.pdf': 'df98573c22e07448befe9001bd43403274614d772dbb5df7dd558387384b2851',
  'tce-1214381.pdf': '8970b58f9a446483e68f5f3a5ebc1ba9831d52d012f12ea50ca8e4f830888b0f',
  'tce-1210770.pdf': '64ef19292371142d5d118e14fa81aae5eb65976bf2212b68c1063bf517b0ef18',
  'tce-1217968.pdf': 'eeeaf1134bc396e98d0c77b39fd0c98c75977bcf9ad51d7664df4609658adf72',
};
export async function snapshot(directory) {
  const result = {};
  async function walk(dir, prefix='') {
    for (const entry of await readdir(dir, {withFileTypes:true})) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(path.join(dir,entry.name),name+'/');
      else result[name] = sha(await readFile(path.join(dir,entry.name)));
    }
  }
  await walk(directory); return result;
}
export async function applyCorrections({directory = path.join(root,'data/catalogo'), apply = false} = {}) {
  const archive = await rows(directory,'arquivo-coletas.ndjson');
  const archiveHash = sha(await readFile(path.join(directory,'arquivo-coletas.ndjson')));
  const reviews = await rows(directory,'revisoes-eventos.ndjson');
  const definitions = await rows(directory,'atos-identificados.ndjson');
  const manifestPath = path.join(directory,`${BATCH}.json`);
  const prior = await readFile(manifestPath,'utf8').then(JSON.parse).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  const affected = [IDS.div,IDS.duplicate,IDS.tce,...PROCESSES.map(actId)];
  if (prior) {
    assert.deepEqual(prior.ids,affected,'Manifesto incompleto');
    for (const id of affected) {
      const found=reviews.filter(r=>r.documento_id===id);
      assert.equal(found.length,1,'Revisão duplicada/ausente');
      assert.equal(found[0].lote_retroativo,BATCH);
      assert.equal(found[0].publicar,false);
      assert.deepEqual(found[0],prior.appliedReviews.find(r=>r.documento_id===id),'Revisão mudou após aplicação');
    }
    for (const n of PROCESSES) assert.equal(definitions.filter(d=>d.documento_pai_id===IDS.tce&&d.chave_ato===actKey(n)).length,1);
    for (const doc of prior.documents) assert.equal(sha(await readFile(path.join(root,'data/documentos-primarios',doc.file))),doc.sha256);
    return {alreadyApplied:true,changed:false,whatsappCalls:0};
  }
  const protectedState = await snapshot(path.join(root,'state'));
  const bundleDir = path.join(root,'output/document-recovery-2026-10-16');
  const bundle = JSON.parse(await readFile(path.join(bundleDir,'validated-evidence.json'),'utf8'));
  assert.equal(bundle.documents.length,5);
  const docs = new Map(bundle.documents.map(d=>[d.file,d]));
  for (const [name,hash] of Object.entries(expected)) {
    assert.equal(docs.get(name)?.sha256,hash);
    assert.equal(sha(await readFile(path.join(bundleDir,name))),hash);
    for (const {page,quote} of docs.get(name).checked_quotes) assert.ok(docs.get(name).pages[page-1].includes(quote));
  }
  const byId = new Map(archive.map(r=>[r.id,r]));
  for (const id of [IDS.div,IDS.duplicate,IDS.tce]) assert.ok(byId.has(id));
  const texts = await rows(directory,'textos-artigos.ndjson');
  const divTexts = [IDS.div,IDS.duplicate].map(id=>texts.find(t=>t.documento_id===id));
  assert.equal(divTexts[0].texto,divTexts[1].texto,'Duplicata precisa de corpo igual');
  assert.equal(sha(divTexts[0].texto),divTexts[0].texto_sha256);
  const reference = (file, title, page, quote) => {
    const doc=docs.get(file); assert.ok(doc.pages[page-1].includes(quote),`${file}: trecho ausente`);
    return {titulo:title,url:doc.url,pagina:page,trecho:quote,pdf_sha256:doc.sha256};
  };
  const reviewedAt = new Date().toISOString();
  const common = (id, row) => ({documento_id:id,lote_retroativo:BATCH,revisado_em:reviewedAt,
    validacao:'Revisão documental autorizada pelo usuário; PDFs primários conferidos por página. Não é decisão automática da IA.',
    trecho_sha256:sha(row.trecho||''),publicar:false,motivo_publicacao:noSend});
  const divDoc=docs.get('divinopolis-lei-9770.pdf');
  const divReview = {...common(IDS.div,byId.get(IDS.div)),decisao:'confirmar_evento',categoria:'GOVERNANÇA',
    titulo:'Divinópolis: Lei 9.770/2026 autoriza subscrever a extinção do Mulheres das Gerais',
    etapa:'lei sancionada e publicada; autorização para subscrever extinção, sem extinção efetiva comprovada',
    motivo:'A Lei 9.770/2026 sucede o PL EM 51/2026 e revoga a Lei 9.013/2022. Comprova autorização legislativa, não saída consumada nem extinção efetiva do consórcio. A notícia da votação e o ato posterior são preservados como etapas do mesmo episódio.',
    evidencia:'Fica o Poder Executivo Municipal autorizado a subscrever a extinção do Consórcio Regional de Promoção da Cidadania - Mulheres das Gerais',
    fonte_evidencia:divDoc.url+'#page=1',data_fato:'2026-09-21T12:00:00Z',
    fatos:{ano:2026,lei:'9770/2026',municipio:'Divinópolis',uf:'MG',consorcio:'Consórcio Regional de Promoção da Cidadania - Mulheres das Gerais',
      tipo_documento:'lei municipal',publicacao_da_lei:'24/09/2026',aprovacao_do_projeto:'17/09/2026',sancao:'21/09/2026',limite:'Autorização não comprova extinção efetiva. A data da notícia original não foi substituída pela data da lei.'},
    documentos_primarios:[reference('divinopolis-lei-9770.pdf','Lei 9.770/2026',1,'autorizado a subscrever a extinção'),
      reference('divinopolis-publicacao.pdf','Publicação oficial · edição 4367',1,'Publicada em 24/09/2026')],
    urls_documento:[byId.get(IDS.div).url,...divTexts.map(t=>t.url_artigo),divDoc.url,docs.get('divinopolis-publicacao.pdf').url,'https://sapl.divinopolis.mg.leg.br/norma/22340'],
  };
  const duplicate = {...common(IDS.duplicate,byId.get(IDS.duplicate)),decisao:'duplicata',categoria:'GERAL',
    documento_relacionado:IDS.div,motivo:'Mesmo corpo integral da publicação já vinculada à Lei 9.770/2026; URL diferente não cria outro fato.',
    evidencia:divReview.evidencia,fonte_evidencia:divReview.fonte_evidencia,documentos_primarios:divReview.documentos_primarios,
    urls_documento:[byId.get(IDS.duplicate).url]};
  const outcomes = [
    {n:'1214381',name:'Consórcio Interfederativo de Minas Gerais',sigla:'CIMINAS',
      title:'TCE-MG referenda suspensão cautelar da ata 041/2026 do CIMINAS',
      stage:'suspensão cautelar referendada; sem julgamento definitivo de irregularidade',
      reason:'Acórdão de 29/09/2026 suspende os efeitos da ARP 041/2026 e proíbe contratações e adesões à ata. A multa de R$ 5 mil é advertência para eventual descumprimento, não multa já aplicada.',
      quote:'determinou a suspensão dos efeitos da Ata de Registro de Preços nº 041/2026',published:'2026-10-08'},
    {n:'1210770',name:'Consórcio Interfederativo de Minas Gerais',sigla:'CIMINAS',
      title:'TCE-MG encerra processo do CIMINAS sem mérito e multa presidente em R$ 10 mil',
      stage:'extinção processual sem resolução de mérito por perda de objeto; multa ao presidente',
      reason:'O certame foi revogado. O acórdão extingue o processo sem resolução de mérito e aplica multa de R$ 10 mil a Frederico Ozanan Rangel por não comunicar a revogação. Não é mera manutenção de cautelar, multa à pessoa jurídica do consórcio ou extinção do consórcio.',
      quote:'declarar a extinção do processo, sem resolução de mérito',published:'2026-10-14'},
    {n:'1217968',name:'Consórcio Regional de Saneamento Básico',sigla:'CONSANE',
      title:'TCE-MG referenda suspensão cautelar da ata 4/2026 do CONSANE',
      stage:'suspensão cautelar referendada; divergência da notícia preservada',
      reason:'Acórdão 1217968 suspende os efeitos da ARP 4/2026 de uniformes escolares. A notícia cita 1217068 e outro nome por extenso. Associação editorial por sessão, relator, sigla e resultado; sem errata oficial localizada. A multa diária é condicional, não aplicada.',
      quote:'suspensão dos efeitos da Ata de Registro de Preços n. 4/2026',published:'2026-10-08'},
  ];
  const childReviews=[]; const newDefinitions=[];
  for (const d of outcomes) {
    const doc=docs.get(`tce-${d.n}.pdf`), id=actId(d.n);
    assert.ok(doc.pages[0].includes('Processo: '+d.n));
    assert.ok(doc.pages[1].includes(d.quote));
    const definition={documento_pai_id:IDS.tce,chave_ato:actKey(d.n),pagina_inicio:2,pagina_fim:2,
      url_pdf:doc.url,pdf_sha256:doc.sha256,titulo:d.title,categoria:'CONTROLE',etapa:d.stage,tipo_documento:'acórdão do TCE-MG',
      fonte:'TCE-MG · acórdão',data_publicacao:d.published+'T12:00:00Z',data_fato:'2026-09-29T12:00:00Z',
      consorcio:d.name,sigla:d.sigla,trecho:d.quote};
    newDefinitions.push(definition);
    childReviews.push({...common(id,definition),trecho_sha256:sha(d.quote),decisao:'confirmar_evento',categoria:'CONTROLE',
      titulo:d.title,etapa:d.stage,motivo:d.reason,evidencia:d.quote,fonte_evidencia:doc.url+'#page=2',data_fato:definition.data_fato,
      fatos:{ano:2026,processo:d.n,consorcio:d.name,sigla:d.sigla,uf:'MG',tipo_documento:'acórdão do TCE-MG',pagina_pdf:2,
        limite:d.reason,...(d.n==='1210770'?{multa_aplicada_reais:10000,destinatario_multa:'Frederico Ozanan Rangel',apenso:'1211638'}:{}),
        ...(d.n==='1217968'?{numero_na_noticia:'1217068',numero_no_acordao:'1217968'}:{})},
      documentos_primarios:[reference(doc.file,`Acórdão ${d.n} · identificação`,1,'Processo: '+d.n),
        reference(doc.file,`Acórdão ${d.n} · dispositivo`,2,d.quote),
        ...(d.n==='1210770'?[reference(doc.file,'Multa aplicada ao responsável',2,'aplicar multa no valor de R$10.000,00')]:[])],
      ...(d.n==='1217968'?{divergencia_fonte:DIVERGENCE}:{}),urls_documento:[doc.url]});
  }
  const parentReview={...common(IDS.tce,byId.get(IDS.tce)),decisao:'desdobrado',categoria:'GERAL',
    motivo:'Notícia preservada, desdobrada em três atos confirmados pelos acórdãos. A revisão anterior generalizava manutenção de cautelares; 1210770 tem extinção processual e multa. Não contar esta notícia como um quarto fato.',
    evidencia:'Documentos primários da sessão de 29/09/2026: 1214381, 1210770 e 1217968.',
    fonte_evidencia:docs.get('tce-1210770.pdf').url,divergencia_fonte:DIVERGENCE,
    documentos_primarios:childReviews.map(r=>r.documentos_primarios[1]),
    urls_documento:[byId.get(IDS.tce).url,byId.get(IDS.tce).article_url,'https://tce.mg.gov.br/noticia/Detalhe/1111629212','https://www.tce.mg.gov.br/noticia/Detalhe/1111629212'].filter(Boolean)};
  const nextReviews=[divReview,duplicate,parentReview,...childReviews];
  const staged=await mkdtemp(path.join(root,'output/primary-application-'));
  await cp(directory,staged,{recursive:true});
  await writeRows(staged,'revisoes-eventos.ndjson',[...reviews.filter(r=>!affected.includes(r.documento_id)),...nextReviews]);
  assert.ok(!definitions.some(d=>d.documento_pai_id===IDS.tce),'Desdobramento já existe sem manifesto');
  await writeRows(staged,'atos-identificados.ndjson',[...definitions,...newDefinitions]);
  const evidence=await rows(directory,'evidencias-complementares.ndjson');
  await writeRows(staged,'evidencias-complementares.ndjson',[...evidence.filter(e=>!affected.includes(e.documento_id)),
    ...[divReview,...childReviews].map(r=>({documento_id:r.documento_id,nome:r.fatos.consorcio,sigla:r.fatos.sigla||'',cnpj:'',
      fonte_evidencia:r.fonte_evidencia,evidencia:r.motivo}))]);
  const manifest={batch:BATCH,ids:affected,whatsapp:false,originalArchiveSha256:archiveHash,
    previousReviews:reviews.filter(r=>affected.includes(r.documento_id)),appliedReviews:nextReviews,
    documents:bundle.documents,approved:'Usuário autorizou aplicação retroativa e painel, mantendo divergência, sem duplicar ou reenviar.',
    simulationActivated:false};
  await writeFile(path.join(staged,`${BATCH}.json`),JSON.stringify(manifest,null,2)+'\n');
  const counts=await saveCatalog(staged,await loadCatalog(path.join(staged,'arquivo-coletas.ndjson')));
  assert.equal(sha(await readFile(path.join(staged,'arquivo-coletas.ndjson'))),archiveHash);
  const events=(await readFile(path.join(staged,'eventos.csv'),'utf8')).split('\n').slice(1).filter(Boolean);
  const ids=events.map(l=>/^"([a-f0-9]{64})"/.exec(l)?.[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const id of [IDS.div,...PROCESSES.map(actId)]) assert.equal(ids.filter(v=>v===id).length,1);
  for(const id of [IDS.duplicate,IDS.tce]) assert.ok(!ids.includes(id));
  for(const id of [IDS.div,...PROCESSES.map(actId)]) assert.ok(events.find(l=>l.startsWith('"'+id+'"')).includes('"historico"'));
  if(apply) {
    await mkdir(path.join(root,'data/documentos-primarios'),{recursive:true});
    for(const doc of bundle.documents) await cp(path.join(bundleDir,doc.file),path.join(root,'data/documentos-primarios',doc.file));
    for(const name of await readdir(staged)) {
      const next=await readFile(path.join(staged,name));
      const prev=await readFile(path.join(directory,name)).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
      if(!prev?.equals(next)) await writeFile(path.join(directory,name),next);
    }
  }
  assert.deepEqual(await snapshot(path.join(root,'state')),protectedState,'Estado de envio alterado');
  return {applied:apply,counts,newActs:3,canonicalFacts:4,duplicatePublications:1,whatsappCalls:0,staged};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await applyCorrections({apply:process.argv.includes('--apply')}),null,2));
