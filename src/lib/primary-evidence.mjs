// Read-only resolver. Not wired into the production collector or sender.
// An approved documentary review takes precedence; it is NOT an AI decision.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {materializeDocumentActs} from './document-acts.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const block=reason=>({decision:'pendente',reason,basis:'documentary_integrity_failed',publicationAllowed:false});

export function createPrimaryEvidenceContext({archive,definitions,reviews,manifest,pdfBytes}){
  const rows=new Map([...archive,...materializeDocumentActs(archive,definitions)].map(x=>[x.id,x]));
  const current=new Map(reviews.map(x=>[x.documento_id,x]));
  const approved=new Map(manifest.appliedReviews.map(x=>[x.documento_id,x]));
  const docs=new Map(manifest.documents.map(x=>[x.sha256,x]));
  function validate(id){
    const r=current.get(id),a=approved.get(id),row=rows.get(id);
    if(!a||!r||!row||!manifest.approved||!isDeepStrictEqual(r,a))return {error:'revisao_ausente_ou_diferente_da_aprovada'};
    if(sha(row.trecho||'')!==r.trecho_sha256)return {error:'revisao_desvinculada_do_trecho_original'};
    if(r.publicar!==false)return {error:'revisao_historica_sem_bloqueio_de_envio'};
    const proofs=[];
    if(!r.documentos_primarios?.length)return {error:'sem_documento_primario'};
    for(const ref of r.documentos_primarios){
      const doc=docs.get(ref.pdf_sha256),bytes=doc&&pdfBytes.get(doc.file);
      if(!doc||!bytes||sha(bytes)!==doc.sha256||doc.url!==ref.url)return {error:'pdf_ausente_hash_ou_url_divergente'};
      if(!Number.isInteger(ref.pagina)||ref.pagina<1||ref.pagina>doc.pages.length)return {error:'pagina_invalida'};
      const text=doc.pages[ref.pagina-1],start=text.indexOf(ref.trecho);
      if(!ref.trecho||start<0)return {error:'trecho_nao_encontrado_na_pagina'};
      proofs.push({...ref,start,end:start+ref.trecho.length,sourceKind:'primary_pdf',reviewId:r.documento_id});
    }
    let evidenceLocation=null;
    for(const proof of proofs){const page=docs.get(proof.pdf_sha256).pages[proof.pagina-1];const start=page.indexOf(r.evidencia);
      if(start>=0&&r.evidencia?.length>=25){evidenceLocation={sourceKind:'primary_pdf',url:proof.url,page:proof.pagina,
        pdfHash:proof.pdf_sha256,start,end:start+r.evidencia.length,text:r.evidencia};break;}}
    if(r.decisao!=='desdobrado'&&!evidenceLocation)return {error:'evidencia_principal_fora_das_paginas_validadas'};
    return {review:r,row,proofs,evidenceLocation};
  }
  function fact(id){const v=validate(id);if(v.error)return block(v.error);
    const r=v.review;if(!['confirmar_evento','corrigir_categoria'].includes(r.decisao))return block('destino_canonico_nao_confirmado');
    return {decision:'aceito',canonicalId:id,category:r.categoria,stage:r.etapa,reason:r.motivo,evidence:r.evidencia,
      entity:r.fatos?.consorcio||'',facts:r.fatos||{},basis:'approved_primary_document_review',
      reviewId:id,reviewedAt:r.revisado_em,primaryEvidence:v.proofs,evidenceLocation:v.evidenceLocation,
      primarySource:r.fonte_evidencia,sourceDivergence:r.divergencia_fonte||null,
      publicationAllowed:false,publicationReason:r.motivo_publicacao};
  }
  function resolve(id,original){
    if(!approved.has(id))return null;
    const v=validate(id);if(v.error)return {...block(v.error),originalAssessment:original};
    const r=v.review,common={originalAssessment:original,originalSource:v.row.url,publicationAllowed:false};
    if(r.decisao==='duplicata'){
      const target=fact(r.documento_relacionado);
      if(target.decision!=='aceito')return {...block('destino_da_duplicata_sem_prova_valida'),...common};
      return {...common,decision:'duplicata',reason:r.motivo,basis:'approved_primary_document_review',
        canonicalId:r.documento_relacionado,canonicalFact:target,primaryEvidence:v.proofs,
        evidence:r.evidencia,evidenceLocation:v.evidenceLocation,reviewId:id};
    }
    if(r.decisao==='desdobrado'){
      const children=[...rows.values()].filter(x=>x.documento_pai_id===id).map(x=>fact(x.id));
      if(!children.length||children.some(x=>x.decision!=='aceito'))return {...block('ato_derivado_sem_prova_valida'),...common};
      return {...common,decision:'desdobrar',reason:r.motivo,basis:'approved_primary_document_review',
        sourceDivergence:r.divergencia_fonte||null,primaryEvidence:v.proofs,children};
    }
    return {...fact(id),...common};
  }
  return {resolve,validate,rows};
}

export async function loadPrimaryEvidenceContext(root=process.cwd()){
  const dir=path.join(root,'data/catalogo');
  const nd=async n=>(await readFile(path.join(dir,n+'.ndjson'),'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest=JSON.parse(await readFile(path.join(dir,'documentos-primarios-2026-10-16.json'),'utf8'));
  const pdfBytes=new Map(await Promise.all(manifest.documents.map(async d=>{
    if(path.basename(d.file)!==d.file)throw Error('Nome de arquivo primário inválido');
    return [d.file,await readFile(path.join(root,'data/documentos-primarios',d.file))];
  })));
  return createPrimaryEvidenceContext({archive:await nd('arquivo-coletas'),definitions:await nd('atos-identificados'),
    reviews:await nd('revisoes-eventos'),manifest,pdfBytes});
}

export function integratePrimaryEvidence(entry,context){
  const documentary=context.resolve(entry.id,entry.proposal);
  if(!documentary)return {...entry,integrated:entry.proposal,publicationAllowed:false,simulationOnly:true};
  if(documentary.decision==='desdobrar'){
    const matched=new Set();
    const children=documentary.children.map(f=>{
      const process=f.facts.processo,reported=f.facts.numero_na_noticia;
      const candidates=entry.children.filter(c=>c.process===process||
        (reported&&f.sourceDivergence&&documentary.sourceDivergence&&c.process===reported));
      if(candidates.length!==1||matched.has(candidates[0].process))return {...block('vinculo_de_processo_nao_univoco'),canonicalId:f.canonicalId};
      const source=candidates[0];matched.add(source.process);
      return {...f,originalProcess:source.process,primaryProcess:process,originalAssessment:source.proposal,
        originalSpan:{start:source.start,end:source.end},
        relationship:reported?'vinculo_editorial_explicito_com_divergencia':'numero_exato_no_ato_do_mesmo_documento_pai'};
    });
    if(matched.size!==entry.children.length||children.some(x=>x.decision!=='aceito'))
      return {...entry,integrated:{...block('segmentos_e_atos_sem_correspondencia_validada'),children},publicationAllowed:false,simulationOnly:true};
    return {...entry,integrated:{...documentary,children},publicationAllowed:false,simulationOnly:true};
  }
  return {...entry,integrated:documentary,publicationAllowed:false,simulationOnly:true};
}
