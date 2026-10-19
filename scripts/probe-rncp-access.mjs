// Bounded public routes and standard curl; never import cookies or solve challenges.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
const exec=promisify(execFile);
const urls=['https://www.rncp.org.br/noticias','https://www.rncp.org.br/','https://rncp.org.br/',
  'https://www.rncp.org.br/sitemap.xml'];
const rows=[];
for(const url of urls){
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const html=await r.text();
    rows.push({method:'node',url,finalUrl:r.url,status:r.status,chars:html.length,
      cards:(html.match(/class="post-item/g)||[]).length,title:html.match(/<title>(.*?)<\/title>/is)?.[1]||''});
  }catch(error){rows.push({method:'node',url,error:error.message});}
}
try{
  const {stdout}=await exec('curl',['--http1.1','--ipv4','--max-time','20','--connect-timeout','10',
    '--max-filesize','2000000','--proto','=https','--user-agent','RadarConsorciosIPEA/0.3 (+pesquisa academica)',
    '--silent','--show-error','--write-out','\n__STATUS__%{http_code}',urls[0]],{timeout:25000,maxBuffer:2100000,windowsHide:true});
  rows.push({method:'curl-http1-ipv4',url:urls[0],status:Number(stdout.match(/__STATUS__(\d+)/)?.[1]),
    chars:stdout.length,cards:(stdout.match(/class="post-item/g)||[]).length,title:stdout.match(/<title>(.*?)<\/title>/is)?.[1]||''});
}catch(error){rows.push({method:'curl-http1-ipv4',error:error.message.slice(0,180)});}
await mkdir('output/direct-gazettes',{recursive:true});
await writeFile('output/direct-gazettes/rncp-access.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows,null,2));
