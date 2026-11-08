// GitHub-only recovery in an isolated copy. Production data and delivery stay untouched.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,symlink,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {isolatedTestEnvironment} from './isolated-environment.mjs';
const exec=promisify(execFile),root=process.cwd();
assert.equal(process.env.GITHUB_ACTIONS,'true','Leituras reais deste estudo somente no GitHub');
const batch=JSON.parse(await readFile('data/catalogo/triagem-38-alvos.json','utf8'));
const requested=process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6);
const ids=requested?requested.split(','):batch.targets.filter(t=>t.needsReading).map(t=>t.id);
assert.ok(ids.length<=10&&ids.every(id=>/^[a-f0-9]{64}$/.test(id)));
if(requested)assert.ok(ids.length<=2&&new Set(ids).size===ids.length);
const nd=async p=>(await readFile(p,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const before=await nd('data/catalogo/arquivo-coletas.ndjson');
assert.ok(ids.every(id=>before.some(r=>r.id===id)),'Registro solicitado ausente');
const reviewed=new Set((await nd('data/catalogo/revisoes-eventos.ndjson')).map(r=>r.documento_id));
const eligible=before.filter(r=>ids.includes(r.id)&&(!requested||r.decisao_base==='processando'&&!reviewed.has(r.id)&&
 (!r.article_next_attempt_at||Date.parse(r.article_next_attempt_at)<=Date.now())));
const pdf=eligible.filter(r=>/\.pdf(?:[?#]|$)/i.test(r.article_resolved_url||r.article_url||r.url)||r.article_recovery_reason==='destino_pdf').map(r=>r.id);
const html=eligible.filter(r=>!pdf.includes(r.id)).map(r=>r.id);
const work=await mkdtemp(path.join(tmpdir(),'radar-pending-study-'));
try {
 const {stdout}=await exec('git',['ls-files'],{maxBuffer:128*1024*1024});
 for(const f of stdout.trim().split(/\r?\n/)){await mkdir(path.dirname(path.join(work,f)),{recursive:true});await cp(path.join(root,f),path.join(work,f));}
 await symlink(path.join(root,'node_modules'),path.join(work,'node_modules'),process.platform==='win32'?'junction':'dir');
 const env=isolatedTestEnvironment();
 for(const [script,selected,args]of[['backfill-google-pdfs.mjs',pdf,['--retry-failed','--limit=10']],['backfill-article-text.mjs',html,[...(!requested?['--force']:[]),'--include-sent']]]){
  if(!selected.length)continue;
  await exec(process.execPath,['scripts/'+script,'--ids='+selected.join(','),'--apply',...args],
    {cwd:work,env,timeout:9*60000,maxBuffer:128*1024*1024});
 }
 const archive=(await nd(path.join(work,'data/catalogo/arquivo-coletas.ndjson'))).filter(r=>ids.includes(r.id));
 const texts=(await nd(path.join(work,'data/catalogo/textos-artigos.ndjson'))).filter(r=>ids.includes(r.documento_id));
 const audits=(await nd(path.join(work,'data/catalogo/recuperacao-pdf-google.ndjson'))).filter(r=>ids.includes(r.documento_id));
 await mkdir('output/public-recovery',{recursive:true});
 await writeFile('output/public-recovery/pending-batch-study.json',JSON.stringify({version:1,at:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID,
  archive,texts,audits,aiCalls:0,whatsappSends:0,productionWrites:0},null,2));
 console.log(JSON.stringify({requested:ids.length,eligible:eligible.length,attempted:archive.filter(r=>r.article_attempted_at!==before.find(b=>b.id===r.id)?.article_attempted_at).length,texts:texts.length,aiCalls:0,whatsappSends:0,productionWrites:0}));
}finally{await rm(work,{recursive:true,force:true});}
