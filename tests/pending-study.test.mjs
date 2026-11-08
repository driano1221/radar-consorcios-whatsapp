import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {isolatedTestEnvironment} from '../scripts/isolated-environment.mjs';
const exec=promisify(execFile),script=path.resolve('scripts/study-pending-batch.mjs'),ids=['a'.repeat(64),'b'.repeat(64)];
async function fixture(t,rows){
 const dir=await mkdtemp(path.join(os.tmpdir(),'pending-study-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(path.join(dir,'data/catalogo'),{recursive:true});await mkdir(path.join(dir,'scripts'));await mkdir(path.join(dir,'node_modules'));
 const files={'arquivo-coletas.ndjson':rows.map(JSON.stringify).join('\n')+'\n','textos-artigos.ndjson':'','revisoes-eventos.ndjson':'','recuperacao-pdf-google.ndjson':'','triagem-38-alvos.json':'{"targets":[]}'};
 for(const[name,value]of Object.entries(files))await writeFile(path.join(dir,'data/catalogo',name),value);
 for(const[kind,name]of[['pdf','backfill-google-pdfs.mjs'],['html','backfill-article-text.mjs']])await writeFile(path.join(dir,'scripts',name),
  `import{readFile,writeFile}from'node:fs/promises';const p='data/catalogo/arquivo-coletas.ndjson',ids=process.argv.find(x=>x.startsWith('--ids=')).slice(6).split(',');const rows=(await readFile(p,'utf8')).trim().split(/\\n/).map(JSON.parse);for(const r of rows)if(ids.includes(r.id)){r.studyReader='${kind}';r.article_attempted_at=new Date().toISOString();r.article_attempts=(r.article_attempts||0)+1;}await writeFile(p,rows.map(JSON.stringify).join('\\n')+'\\n');`);
 const env={...isolatedTestEnvironment(),GITHUB_ACTIONS:'true'};
 await exec('git',['init','--quiet'],{cwd:dir,env,windowsHide:true});await exec('git',['add','.'],{cwd:dir,env,windowsHide:true});
 return{dir,files,env};
}
test('estudo de pendências não consulta caso concluído nem ignora recuo salvo',async t=>{
 const{dir,files,env}=await fixture(t,[{id:ids[0],decisao_base:'descartado'},{id:ids[1],decisao_base:'processando',article_next_attempt_at:'2099-01-01T00:00:00Z'}]);
 const{stdout}=await exec(process.execPath,[script,'--ids='+ids.join(',')],{cwd:dir,env,timeout:30000,maxBuffer:64*1024*1024,windowsHide:true});
 const result=JSON.parse(stdout);assert.equal(result.eligible,0);assert.equal(result.attempted,0);
 assert.equal(await readFile(path.join(dir,'data/catalogo/arquivo-coletas.ndjson'),'utf8'),files['arquivo-coletas.ndjson']);
});
test('estudo encaminha PDF sem extensão ao leitor próprio e só altera a cópia isolada',async t=>{
 const{dir,files,env}=await fixture(t,[{id:ids[0],decisao_base:'processando',url:'https://oficial.gov.br/doc/1',article_recovery_reason:'destino_pdf'},
  {id:ids[1],decisao_base:'processando',url:'https://oficial.gov.br/noticia',article_recovery_reason:'http_403'}]);
 const{stdout}=await exec(process.execPath,[script,'--ids='+ids.join(',')],{cwd:dir,env,timeout:30000,maxBuffer:64*1024*1024,windowsHide:true});
 const result=JSON.parse(stdout),artifact=JSON.parse(await readFile(path.join(dir,'output/public-recovery/pending-batch-study.json'),'utf8'));
 assert.equal(result.attempted,2);assert.deepEqual(artifact.archive.map(r=>r.studyReader),['pdf','html']);
 assert.deepEqual([artifact.aiCalls,artifact.whatsappSends,artifact.productionWrites],[0,0,0]);
 for(const[name,value]of Object.entries(files))assert.equal(await readFile(path.join(dir,'data/catalogo',name),'utf8'),value);
});
