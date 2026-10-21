// Offline maintenance: no collectors, AI/API clients or WhatsApp imports.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, mkdtemp, cp, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadCatalog, saveCatalog} from '../src/lib/catalog.mjs';
import {rowFingerprint} from '../src/lib/simple-triage.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const rows=async(dir,name)=>(await readFile(path.join(dir,`${name}.ndjson`),'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const json=async file=>JSON.parse(await readFile(file,'utf8'));

export async function prepareJointReview(dir='data/catalogo') {
  const manifest=await json(path.join(dir,'revisao-conjunta-39.json'));
  const addedText=await json(path.join(dir,'revisao-conjunta-39-texto.json'));
  const [archive,texts,reviews]=await Promise.all(['arquivo-coletas','textos-artigos','revisoes-eventos'].map(n=>rows(dir,n)));
  assert.equal(manifest.cases.length,39); assert.equal(new Set(manifest.cases.map(c=>c.id)).size,39);
  const byId=new Map(archive.map(r=>[r.id,r])),byText=new Map(texts.map(t=>[t.documento_id,t]));
  assert.equal(sha(addedText.texto),addedText.texto_sha256);
  const oldText=byText.get(addedText.documento_id);
  if(oldText) assert.deepEqual(oldText,addedText,'Não substituir texto recuperado por outra leitura');
  else byText.set(addedText.documento_id,addedText);
  for(const [index,c] of manifest.cases.entries()) {
    assert.equal(c.case,index+1); assert.equal(c.id,c.review.documento_id);
    const row=byId.get(c.id),text=byText.get(c.id),review=c.review;
    assert.ok(row&&text,`Caso ${c.case}: fonte ausente`);
    assert.equal(rowFingerprint(row),c.rowHash,`Caso ${c.case}: registro mudou`);
    assert.equal(sha(text.texto),c.bodyHash,`Caso ${c.case}: íntegra mudou`);
    assert.equal(review.texto_evidencia_sha256,c.bodyHash);
    assert.equal(review.trecho_sha256,sha(row.trecho||''));
    assert.equal(review.publicar,false); assert.equal(review.incluir_resumo,false);
    for(const quote of [review.evidencia,...review.evidencias_adicionais])
      assert.ok(quote.length>30&&text.texto.includes(quote),`Caso ${c.case}: evidência não literal`);
    for(const proof of review.evidencias_relacionadas||[]) {
      const related=byText.get(proof.documento_id);
      assert.ok(related?.texto.includes(proof.trecho)); assert.equal(sha(related.texto),proof.texto_sha256);
    }
    if(review.decisao==='duplicata') {
      assert.ok(byId.has(review.documento_relacionado)); assert.notEqual(c.id,review.documento_relacionado);
      const principal=manifest.cases.find(c=>c.id===review.documento_relacionado)?.review||reviews.find(r=>r.documento_id===review.documento_relacionado);
      assert.equal(principal?.decisao,'confirmar_evento','Duplicata precisa de principal confirmado');
    }
  }
  const resolved=manifest.cases.filter(c=>c.review.decisao!=='pendente');
  const existing=reviews.filter(r=>r.lote_retroativo===manifest.batch);
  if(existing.length) {
    assert.equal(existing.length,resolved.length,'Lote aplicado parcialmente');
    for(const c of resolved) assert.deepEqual(existing.find(r=>r.documento_id===c.id),c.review);
    assert.ok(oldText,'Aplicação anterior sem texto recuperado');
  } else for(const c of resolved) assert.ok(!reviews.some(r=>r.documento_id===c.id),'Revisão preexistente exige conciliação');
  return {manifest,archive,texts,reviews,addedText,resolved,alreadyApplied:existing.length===resolved.length};
}

export async function applyJointReview({apply=false,dir='data/catalogo'}={}) {
  assert.notEqual(process.env.SEND_ENABLED,'true'); assert.notEqual(process.env.PERSIST_STATE,'true');
  const before=await protectedSnapshot(),batch=await prepareJointReview(dir);
  const {manifest,reviews,addedText,resolved}=batch;
  const counts=Object.fromEntries(['confirmar_evento','nao_evento','duplicata','pendente'].map(d=>[d,manifest.cases.filter(c=>c.review.decisao===d).length]));
  await mkdir('output/review-39',{recursive:true});
  const report={batch:manifest.batch,applied:apply,alreadyApplied:batch.alreadyApplied,counts,whatsappCalls:0,aiCalls:0,protectedStateUnchanged:true};
  if(!batch.alreadyApplied) {
    const staged=await mkdtemp('output/review-39/staged-'); await cp(dir,staged,{recursive:true});
    const append=async(name,values)=>{
      const old=await readFile(path.join(staged,`${name}.ndjson`),'utf8');
      await writeFile(path.join(staged,`${name}.ndjson`),old+(old.endsWith('\n')?'':'\n')+values.map(JSON.stringify).join('\n')+'\n');
    };
    await append('revisoes-eventos',resolved.map(c=>c.review));
    if(!batch.texts.some(t=>t.documento_id===addedText.documento_id)) await append('textos-artigos',[addedText]);
    // Keep the original 1–39 report frozen. Only the actual unresolved case
    // gains its new, precise checks in the operational review projection.
    const pending=new Map(manifest.cases.filter(c=>c.review.decisao==='pendente').map(c=>[c.id,c.review]));
    const originalDecisions=(await rows(staged,'triagem-originais')).map(d=>pending.has(d.documentId)?{
      ...d,reason:pending.get(d.documentId).motivo,checks:pending.get(d.documentId).checks,evidence:pending.get(d.documentId).evidencia,
      stage:pending.get(d.documentId).etapa,method:'revisao_conjunta_inconclusiva',reviewedAt:'2026-10-21T23:30:00.000Z'}:d);
    await writeFile(path.join(staged,'triagem-originais.ndjson'),originalDecisions.map(JSON.stringify).join('\n')+'\n');
    await saveCatalog(staged,await loadCatalog(path.join(staged,'arquivo-coletas.ndjson')));
    assert.deepEqual(await rows(staged,'arquivo-coletas'),batch.archive,'Arquivo bruto alterado');
    await writeFile(path.join(staged,'arquivo-coletas.ndjson'),await readFile(path.join(dir,'arquivo-coletas.ndjson')));
    assert.deepEqual((await rows(staged,'revisoes-eventos')).slice(0,reviews.length),reviews,'Histórico reescrito');
    assert.deepEqual(before,await protectedSnapshot(),'Simulação alterou produção');
    report.staged=staged;
    if(apply) for(const name of await readdir(staged)) {
      const content=await readFile(path.join(staged,name));
      const original=await readFile(path.join(dir,name)).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
      if(!original?.equals(content)) await writeFile(path.join(dir,name),content);
    }
  }
  const after=await protectedSnapshot();
  for(const [file,hash] of Object.entries(before)) if(file.startsWith('state')) assert.equal(after[file],hash,`Estado operacional mudou: ${file}`);
  if(!apply||batch.alreadyApplied) assert.deepEqual(after,before);
  const lines=['# Resultado da revisão conjunta — 39 casos','',
    '**22 confirmados, 12 rejeitados, 4 documentos duplicados/complementares e 1 caso ainda em Revisar comigo.**',
    '','Duplicatas ficam em Rejeitadas como registros adicionais. O fato continua no documento principal; não há um quarto status.',
    '','As sete famílias continuam: Criação, Adesão, Saída, Rateio, Protocolo, Crise e Atuação. Governança, Finanças e Controle são subtipos de Atuação. Controle permanece só no painel.',
    '','Todos os 39 casos permanecem bloqueados para alertas e resumo no WhatsApp. Nenhuma captura, fila, recibo ou sessão foi modificada.',
    '','A numeração do relatório original foi preservada. Evidências, hashes e decisões reproduzíveis estão em `data/catalogo/revisao-conjunta-39.json`.',
    '','## Falta conferir','',
    'Somente **caso 31**: [aditivo de Planalto Alegre](https://diariomunicipal.sc.gov.br/atos/8821385) · [verificação de assinaturas](https://cisamosc.1doc.com.br/verificacao/1F80-8913-51CE-5AE9).',
    '','Verificar assinatura do município e obter explicação/retificação para R$ 13.925,40 versus R$ 413.925,40 e contrato 076/2025 versus 76/2026. A página respondeu HTTP 200, mas não expôs os signatários na leitura pública feita; isso não prova ausência de assinatura.','',
    '## Decisões por caso',''];
  const label={confirmar_evento:'Confirmado',nao_evento:'Rejeitado',duplicata:'Rejeitado como registro adicional',pendente:'Revisar comigo'};
  for(const c of manifest.cases) {
    const r=c.review,related=manifest.cases.find(x=>x.id===r.documento_relacionado);
    const parent=batch.archive.find(x=>x.id===r.documento_relacionado);
    lines.push(`### Caso ${c.case} — ${label[r.decisao]}`,'',`[${r.titulo}](${r.fonte_evidencia})`,'',
      ...(r.decisao==='confirmar_evento'?[`Categoria: **${r.categoria}**. Etapa: ${r.etapa}.`,'']:[]),r.motivo,'',
      ...(parent?[`[Documento principal${related?` — caso ${related.case}`:''}](${parent.article_url||parent.url})`,'']:[]),
      `> ${r.evidencia.replace(/\s+/g,' ').trim()}`,'',...(r.checks||[]).map(s=>`- ${s}`),'');
  }
  if(apply) await writeFile('docs/REVISAO-CONJUNTA-39-2026-10-21.md',lines.join('\n').trimEnd()+'\n');
  await writeFile('output/review-39/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report)); return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await applyJointReview({apply:process.argv.includes('--apply')});
