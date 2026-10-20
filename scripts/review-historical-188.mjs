import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {BATCH,urls,accepted,rejectReason} from './historical-188-definitions.mjs';
import {loadCatalog,saveCatalog} from '../src/lib/catalog.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const rows=async(dir,name)=>(await readFile(path.join(dir,`${name}.ndjson`),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
export async function prepareBatch(dir='data/catalogo'){
  const archive=await rows(dir,'arquivo-coletas'),texts=await rows(dir,'textos-artigos'),reviews=await rows(dir,'revisoes-eventos');
  const byUrl=new Map(archive.map(r=>[r.url,r])),byId=new Map(texts.map(r=>[r.documento_id,r]));
  assert.equal(new Set(urls).size,188);
  const decisions=urls.map((url,index)=>{
    const n=index+1,row=byUrl.get(url);assert.ok(row,`Documento ${n} não está arquivado`);
    const t=byId.get(row.id);assert.ok(t?.texto,`Documento ${n} sem íntegra`);
    assert.equal(sha(t.texto),t.texto_sha256,`Texto alterado ${n}`);
    const d=accepted.get(n), rejection=d?null:rejectReason(n);
    const proof=d?.quote||t.texto.match(rejection.pattern)?.[0];
    assert.ok(proof,`Critério não comprovado no documento ${n}`);
    // For exclusions, retain a contiguous contextual passage, not a lone keyword.
    const at=t.texto.indexOf(proof);
    const evidence=d?proof:t.texto.slice(Math.max(0,at-160),at+Math.max(proof.length,600));
    assert.ok(t.texto.includes(evidence),`Prova não literal ${n}`);
    const extras=(d?.quoteExtra||[]).map(quote=>{assert.ok(t.texto.includes(quote),`Prova adicional ausente ${n}: ${quote}`);return quote;});
    if(d?.cnpj)assert.ok(t.texto.includes(d.cnpj),`CNPJ sem prova no próprio documento ${n}`);
    const {quote,quoteExtra,categoria,titulo,etapa,motivo,...facts}=d||{};
    const duplicate=n===139;
    const reason=duplicate?'Termo de adesão de serviços refere-se ao mesmo contrato de programa 025/2026, município, data e valores do extrato principal. Documento complementar do episódio, não novo ingresso nem segundo programa.':motivo||rejection.motivo;
    const related=duplicate?byUrl.get(urls[153])?.id:'';
    const review={documento_id:row.id,lote_retroativo:BATCH,revisado_em:'2026-10-20T16:00:00.000Z',
      validacao:'Triagem dos textos integrais por critérios explícitos, com conferência documental das exceções pelo assistente e decisões de escopo autorizadas pelo usuário. Não é homologação do Ipea nem revisão humana de cada cláusula.',
      metodo_triagem:d?'Revisão documental do assistente com evidência literal; escopo autorizado pelo usuário.':
        `Regra de exclusão conferida para este documento: ${duplicate?'documento complementar do mesmo episódio':rejection.grupo}. Leitura automática integral, com recorte literal rastreável.`,
      decisao:duplicate?'duplicata':d?'confirmar_evento':'nao_evento',categoria:d?categoria:'GERAL',
      titulo:titulo||row.titulo,etapa:etapa||'fora da base; documento preservado no acervo',motivo:reason,
      evidencia:evidence,evidencias_adicionais:extras,fonte_evidencia:t.url_artigo||row.url,
      fatos:{ano:2026,ano_ingresso:'',precisao_data:'ano',...facts,tipo_documento:facts.tipo_documento||'publicação oficial',limite:reason},
      trecho_sha256:sha(row.trecho||''),texto_evidencia_sha256:t.texto_sha256,
      documento_relacionado:related,urls_documento:[...new Set([row.url,t.url_artigo].filter(Boolean))],
      publicar:false,motivo_publicacao:'Lote histórico revisado somente na base e no painel; não incluir em alertas, fila nem resumo do WhatsApp.'};
    assert.ok(!duplicate||related,'Documento principal da duplicata ausente');
    return {n,row,t,review,group:d?'aceito':duplicate?'duplicata':rejection.grupo};
  });
  assert.equal(new Set(decisions.map(d=>d.row.id)).size,188);
  const existing=reviews.filter(r=>r.lote_retroativo===BATCH);
  if(existing.length){
    assert.equal(existing.length,188,'Lote parcial: não aplicar silenciosamente');
    for(const d of decisions){
      const old=existing.find(r=>r.documento_id===d.row.id);assert.ok(old);
      assert.deepEqual(old,d.review,`Revisão do lote mudou: ${d.n}`);
    }
  }else for(const d of decisions)assert.ok(!reviews.some(r=>r.documento_id===d.row.id),`Documento ${d.n} já revisado fora deste lote; requer conciliação`);
  return {archive,texts,reviews,decisions,alreadyApplied:existing.length===188};
}

export async function applyBatch({apply=false,dir='data/catalogo'}={}){
  assert.notEqual(process.env.SEND_ENABLED,'true','Manutenção não aceita envio habilitado');
  assert.notEqual(process.env.PERSIST_STATE,'true','Manutenção não persiste estado de envio');
  const before=await protectedSnapshot(),batch=await prepareBatch(dir);
  const report={batch:BATCH,at:new Date().toISOString(),applied:apply,alreadyApplied:batch.alreadyApplied,
    total:188,confirmed:batch.decisions.filter(d=>d.group==='aceito').length,duplicates:1,
    rejected:batch.decisions.filter(d=>!['aceito','duplicata'].includes(d.group)).length,
    byReason:Object.fromEntries([...new Set(batch.decisions.map(d=>d.group))].map(g=>[g,batch.decisions.filter(d=>d.group===g).length])),
    documentsAdded:0,whatsappCalls:0,protectedStateUnchanged:true,
    cases:batch.decisions.map(({n,row,t,review,group})=>({n,id:row.id,url:row.url,
      originalCategory:row.tipo_evento,decision:review.decisao,category:review.categoria,group,
      title:review.titulo,reason:review.motivo,evidence:review.evidencia,
      textHash:t.texto_sha256,related:review.documento_relacionado,facts:review.fatos}))};
  await mkdir('output/historical-188',{recursive:true});
  if(!batch.alreadyApplied){
    const staged=await mkdtemp('output/historical-188/staged-');await cp(dir,staged,{recursive:true});
    const next=[...batch.reviews,...batch.decisions.map(d=>d.review)];
    const oldEvidence=await rows(dir,'evidencias-complementares');
    const addedEvidence=batch.decisions.filter(d=>d.review.decisao==='confirmar_evento').map(({review})=>({
      documento_id:review.documento_id,nome:review.fatos.consorcio,sigla:review.fatos.sigla||'',cnpj:review.fatos.cnpj||'',
      fonte_evidencia:review.fonte_evidencia,evidencia:review.evidencia}));
    for(const[name,data]of[['revisoes-eventos',next],['evidencias-complementares',[...oldEvidence,...addedEvidence]]])
      await writeFile(path.join(staged,`${name}.ndjson`),data.map(JSON.stringify).join('\n')+'\n');
    await saveCatalog(staged,await loadCatalog(path.join(staged,'arquivo-coletas.ndjson')));
    assert.deepEqual(await rows(staged,'arquivo-coletas'),batch.archive,'Arquivo bruto alterado');
    // Windows checkout can use CRLF; preserve original bytes as well as records.
    await writeFile(path.join(staged,'arquivo-coletas.ndjson'),await readFile(path.join(dir,'arquivo-coletas.ndjson')));
    const sealed=await rows(staged,'revisoes-eventos');assert.deepEqual(sealed.slice(0,batch.reviews.length),batch.reviews);
    const identities=await rows(staged,'identidades');assert.equal(new Set(identities.map(i=>i.id)).size,identities.length);
    assert.deepEqual(before,await protectedSnapshot(),'Simulação alterou arquivos de produção');
    report.staged=staged;
    if(apply)for(const name of await readdir(staged)){
      const content=await readFile(path.join(staged,name));
      const original=await readFile(path.join(dir,name)).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
      if(!original?.equals(content))await writeFile(path.join(dir,name),content);
    }
  }
  const after=await protectedSnapshot();
  for(const[file,hash]of Object.entries(before))if(file.startsWith('state'))assert.equal(after[file],hash,`Estado de envio mudou: ${file}`);
  if(!apply||batch.alreadyApplied)assert.deepEqual(after,before);
  await writeFile('output/historical-188/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,cases:undefined}));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await applyBatch({apply:process.argv.includes('--apply')});
