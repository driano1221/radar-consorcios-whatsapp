// Fixed, inspected delta from the 1,946-document replay. Never sends or queues.
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,mkdtemp,cp,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { classifyItem } from '../src/lib/classifier.mjs';
import { loadCatalog,saveCatalog } from '../src/lib/catalog.mjs';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
import { persistArticleTexts } from '../src/lib/article-text-store.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
const dir='data/catalogo', batch='regras-gerais-2026-10-16';
const rows=async name=>(await readFile(`${dir}/${name}.ndjson`,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const sha=s=>createHash('sha256').update(s).digest('hex');
const reviews=await rows('revisoes-eventos');
const definitions=[
  {prefix:'1806d339',title:'Consórcio ABC realiza visita técnica para conhecer simulador em Taubaté',
    reason:'Visita técnica realizada em Taubaté para conhecer tecnologia. Não comprova compra de simulador nem treinamento já contratado.',
    municipality:'Taubaté'},
  {prefix:'39a744a7',title:'Consórcio ABC realiza reunião sobre reconversão industrial',
    reason:'Reunião do GT Desenvolvimento Econômico realizada, com apresentação de diagnóstico. Não é aprovação de plano industrial nem entrega de investimentos.'},
  {prefix:'965b6035',title:'ABC e Braskem: outra cobertura da reunião já registrada',duplicate:'f46c947c',
    reason:'Mesmo encontro com Camilla Tápias em 9/9, mesmos participantes e temas da cobertura já confirmada. Outra fonte, não outro fato.'},
  {prefix:'cea72684',title:'ABC e Metodista: outra cobertura do acordo de bolsas já registrado',duplicate:'ca8c07d2',
    reason:'Mesmo acordo assinado em 11/9 com o Instituto Metodista, até mil bolsas e benefícios de 100% e 75%. Outra fonte do episódio já confirmado; bolsas concedidas não comprovadas.'},
];
if(reviews.some(r=>r.lote_retroativo===batch)){
  assert.equal(reviews.filter(r=>r.lote_retroativo===batch).length,4);
  console.log('Delta já aplicado; nenhum arquivo ou envio alterado.');
}else{
  const before=await protectedSnapshot(),archive=await rows('arquivo-coletas'),texts=await rows('textos-artigos');
  const evidence=await rows('evidencias-complementares'),now=new Date().toISOString();
  for(const d of definitions){
    const row=archive.find(r=>r.id.startsWith(d.prefix)),t=texts.find(t=>t.documento_id===row?.id);
    assert.ok(row&&!row.enviado_em&&!reviews.some(r=>r.documento_id===row.id));
    assert.equal(t.texto_sha256,sha(t.texto));
    const c=classifyItem({title:row.titulo,rawText:t.texto,kind:'news'});
    assert.equal(c.category,'ATUAÇÃO');assert.ok(['performed_institutional_activity','signed_cooperation'].includes(c.proofKind));
    assert.ok(t.texto.includes(c.evidenceText));
    const related=d.duplicate?archive.find(r=>r.id.startsWith(d.duplicate)).id:'';
    reviews.push({documento_id:row.id,lote_retroativo:batch,revisado_em:now,
      validacao:'Regras gerais e leitura integral conferidas pelo assistente, segundo critérios editoriais autorizados pelo usuário.',
      metodo_triagem:'Regras gerais e leitura integral conferidas pelo assistente, segundo critérios editoriais autorizados pelo usuário.',
      decisao:d.duplicate?'duplicata':'confirmar_evento',categoria:d.duplicate?'GERAL':'ATUAÇÃO',
      titulo:d.title,etapa:c.stage,motivo:d.reason,evidencia:c.evidenceText,fonte_evidencia:t.url_artigo,
      fatos:{ano:2026,ano_ingresso:'',precisao_data:'ano',consorcio:'Consórcio Intermunicipal Grande ABC',sigla:'',uf:'SP',
        municipio:d.municipality||'',tipo_documento:'notícia',limite:d.reason},
      trecho_sha256:sha(row.trecho||''),texto_evidencia_sha256:t.texto_sha256,documento_relacionado:related,
      urls_documento:[...new Set([row.url,t.url_artigo])],publicar:false,
      motivo_publicacao:'Revisão retroativa somente na base; sem envio diário nem resumo semanal.'});
    if(!d.duplicate)evidence.push({documento_id:row.id,nome:'Consórcio Intermunicipal Grande ABC',sigla:'',cnpj:'',
      fonte_evidencia:t.url_artigo,evidencia:c.evidenceText});
  }
  await mkdir('output/general-rules',{recursive:true});
  const staged=await mkdtemp('output/general-rules/application-');await cp(dir,staged,{recursive:true});
  for(const[name,data]of[['revisoes-eventos',reviews],['evidencias-complementares',evidence]])
    await writeFile(`${staged}/${name}.ndjson`,data.map(JSON.stringify).join('\n')+'\n');
  const cnm=archive.find(r=>r.id.startsWith('74fb6772'));
  const cnmUrl='https://cnm.org.br/comunicacao/noticias/municipios-de-santa-catarina-assinam-adesao-ao-conclima-saiba-como-participar';
  const original=await enrichArticle({url:cnmUrl,title:cnm.titulo,source:'CNM',kind:'news'});
  assert.equal(original.articleReader,'cnm_inertia_publica','Não aplicar lote sem validar leitura original');
  assert.ok(original.rawText.includes('Prefeitos de 12 Municípios do Paraná'));
  await persistArticleTexts(staged,[{...original,url:cnm.url}]);
  await saveCatalog(staged,await loadCatalog(`${staged}/arquivo-coletas.ndjson`));
  assert.equal(await readFile(`${dir}/arquivo-coletas.ndjson`,'utf8'),await readFile(`${staged}/arquivo-coletas.ndjson`,'utf8'));
  const eventLines=async directory=>(await readFile(`${directory}/eventos.csv`,'utf8')).trim().split('\n').slice(1);
  const old=await eventLines(dir),next=await eventLines(staged);
  assert.equal(next.length,old.length+2);assert.ok(old.every(r=>next.includes(r)));
  const ids=next.map(r=>r.split(',')[0]);assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(before,await protectedSnapshot());
  if(process.argv.includes('--apply'))for(const name of await readdir(staged)){
    const content=await readFile(path.join(staged,name)),old=await readFile(path.join(dir,name)).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
    if(!old?.equals(content))await writeFile(path.join(dir,name),content);
  }
  const after=await protectedSnapshot();
  for(const[name,hash]of Object.entries(before))if(name.startsWith('state'))assert.equal(after[name],hash);
  console.log(JSON.stringify({applied:process.argv.includes('--apply'),newFacts:2,duplicate:2,
    cnmOriginalChars:original.rawText.length,archiveUnchanged:true,whatsappCalls:0,staged}));
}
