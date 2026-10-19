// Focused, read-only upstream diagnosis. No model, session or sender imports.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fetchQueridoDiario, QD_API_BASE_URL } from '../src/lib/sources/querido-diario.mjs';

const exec = promisify(execFile);
const config = JSON.parse(await readFile('config/default.json','utf8'));
const headers = {'user-agent':'RadarConsorciosIPEA/0.3 (+pesquisa academica)','accept':'application/json'};
async function probe(name,url,{range=false}={}) {
  const start=Date.now();
  try {
    const response=await fetch(url,{headers:{...headers,...(range?{range:'bytes=0-15'}:{})},signal:AbortSignal.timeout(35000)});
    const chunks=[];let bytes=0;
    for await(const chunk of response.body){chunks.push(chunk);bytes+=chunk.length;if(bytes>1_000_000||range)break;}
    const text=Buffer.concat(chunks).toString('utf8');let json;
    try{json=JSON.parse(text);}catch{/* Non-JSON upstream errors are preserved as a short diagnostic. */}
    return {name,url,finalUrl:response.url,status:response.status,contentType:response.headers.get('content-type'),
      server:response.headers.get('server'),durationMs:Date.now()-start,
      jsonValid:!!json,gazetteCount:Array.isArray(json?.gazettes)?json.gazettes.length:null,
      totalGazettes:json?.total_gazettes,
      sample:json?.gazettes?.slice(0,2).map(x=>({date:x.date,url:x.url,territory:x.territory_name,
        state:x.state_code,excerpts:x.excerpts?.length})),
      ...(!json?{bodyPrefix:text.slice(0,120)}:{})};
  }catch(error){return{name,url,status:null,durationMs:Date.now()-start,error:error.message,cause:error.cause?.code||error.code||''};}
}
const envUrl='https://queridodiario.org.br/env.js';
const envResponse=await fetch(envUrl,{signal:AbortSignal.timeout(15000)});
if(!envResponse.ok)throw new Error('Não foi possível consultar a configuração pública do frontend');
const envScript=await envResponse.text();
const advertised=envScript.match(/window\.__env\.apiUrl\s*=\s*['"](https:\/\/[^'"]+)['"]/)?.[1];
if(advertised!==QD_API_BASE_URL||config.queridoDiario.baseUrl!==advertised)
  throw new Error(`Endereço configurado diverge do frontend oficial: ${advertised}`);
const since=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
const targets=[
  ['new_health',advertised+'/health'],
  ['new_docs',advertised+'/openapi.json'],
  ['new_latest',advertised+'/gazettes?size=1&sort_by=descending_date'],
  ['new_search',advertised+'/gazettes?'+new URLSearchParams({querystring:'"consórcio"',published_since:since,size:'2',excerpt_size:'500',sort_by:'descending_date'})],
  ['new_proxy','https://queridodiario.org.br/api/gazettes?size=1'],
  ['legacy_proxy','https://queridodiario.ok.org.br/api/gazettes?size=1'],
  ['legacy_tls','https://api.queridodiario.ok.org.br/gazettes?size=1'],
  ['public_backend','https://backend-api.queridodiario.org.br/api/querido_diario/gazettes/?size=1'],
];
const results=[];
// Low request rate: sequential probes, no loops/retries against the origin.
for(const [name,url]of targets)results.push(await probe(name,url));
let curl;
try{
  const{stdout}=await exec('curl',['--http1.1','--ipv4','--silent','--show-error','--location','--max-redirs','3',
    '--max-time','35','--proto','=https','--proto-redir','=https','--write-out','\nHTTP_STATUS:%{http_code}',advertised+'/health'],
    {timeout:40000,maxBuffer:100000,windowsHide:true});
  curl={client:'curl_http1_ipv4',status:Number(stdout.match(/HTTP_STATUS:(\d+)/)?.[1]),bodyPrefix:stdout.split('\nHTTP_STATUS:')[0].slice(0,120)};
}catch(error){curl={client:'curl_http1_ipv4',error:error.message.slice(0,300)};}
const sample='https://data.queridodiario.ok.org.br/2611606/2026-10-15/fcc1ccda24e2c1bc5b6a7e92e66dd1d1c7bbe3ed.pdf';
const pdf=await probe('existing_official_pdf',sample,{range:true});
const collected=await fetchQueridoDiario({...config.queridoDiario,queryGroups:config.queridoDiario.queryGroups.slice(0,2)},new Date(since));
const newLatest=results.find(x=>x.name==='new_latest');
const functional=!!(newLatest?.status===200&&newLatest.gazetteCount>0&&collected.ok);
const report={at:new Date().toISOString(),environment:process.env.GITHUB_ACTIONS?'github_actions':'local',
  advertisedApi:{source:envUrl,baseUrl:advertised},functional,whatsappCalls:0,
  results,curl,pdf,collector:{items:collected.items.length,ok:collected.ok,degraded:collected.degraded,diagnostics:collected.diagnostics},
  conclusion:functional?'API operacional com diários reais; domínio atual validado.'
    :'API atual também indisponível: requer recuperação do serviço upstream, não só correção do endereço do cliente.'};
await mkdir('output/querido-diario-diagnosis',{recursive:true});
await writeFile('output/querido-diario-diagnosis/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!functional)process.exitCode=1;
