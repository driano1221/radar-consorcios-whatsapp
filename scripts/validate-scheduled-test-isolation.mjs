// Runs under production-like flags, without production entrypoints or secrets.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
import {weeklyWindow,buildWeeklyReport} from '../src/lib/history.mjs';
import {prepareWeeklyState} from '../src/lib/weekly-selection.mjs';
import {formatWeeklyMessages} from '../src/lib/format.mjs';
import {isWhatsAppCategoryAllowed} from '../src/lib/whatsapp-policy.mjs';

const profile=process.env.ISOLATION_PROFILE;
assert.ok(['radar','weekly'].includes(profile),'Perfil inválido');
assert.equal(process.env.SEND_ENABLED,'true','Teste precisa reproduzir o sinal de envio da produção');
assert.equal(process.env.PERSIST_STATE,profile==='radar'?'true':'');
for(const key of ['BOT_STATE_PASSWORD','DEEPSEEK_API_KEY','WHATSAPP_GROUP_ID','WHATSAPP_WEEKLY_GROUP_ID'])
  assert.ok(!process.env[key],`Validação não pode receber ${key}`);
const flags={SEND_ENABLED:process.env.SEND_ENABLED,PERSIST_STATE:process.env.PERSIST_STATE,AI_REVIEW_ENABLED:process.env.AI_REVIEW_ENABLED};
const before=await protectedSnapshot(),out=`output/test-isolation/${profile}`;
await mkdir(out,{recursive:true});
const exec=promisify(execFile);
async function run(args,filename){
  try{
    const {stdout,stderr}=await exec(process.execPath,args,{encoding:'utf8',maxBuffer:20_000_000,timeout:180000,windowsHide:true});
    await writeFile(`${out}/${filename}`,stdout+stderr);
    console.log(stdout.split(/\r?\n/).filter(l=>/^# (?:tests|pass|fail|duration_ms)|^\[testes\]/.test(l)).join('\n'));
  }catch(error){
    await writeFile(`${out}/${filename}`,(error.stdout||'')+(error.stderr||''));
    throw new Error(`Validação falhou: ${filename}; consulte o artefato (exit ${error.code}).`);
  }
}
// Covers both the canonical npm test implementation and direct Node usage.
await run(['scripts/run-tests.mjs'],'suite.log');
await run(['--test','tests/historical-188.test.mjs','tests/actions-weekly-safety.test.mjs'],'direct-node.log');
assert.deepEqual(flags,{SEND_ENABLED:process.env.SEND_ENABLED,PERSIST_STATE:process.env.PERSIST_STATE,AI_REVIEW_ENABLED:process.env.AI_REVIEW_ENABLED},'Testes mudaram as flags do processo de produção');

// Read-only weekly selection/formatting with the real catalog and two Saturday
// schedules. No src/weekly.mjs, transport, shortening, decryption or API calls.
const state=JSON.parse(await readFile('state/news-state.json','utf8')),original=JSON.stringify(state);
const config=JSON.parse(await readFile('config/default.json','utf8'));
const previews=[];
for(const time of ['2026-10-24T12:00:00Z','2026-10-24T15:00:00Z']){
  const window=weeklyWindow(new Date(time));
  const prepared=await prepareWeeklyState(state,'data/catalogo',window,{
    lookbackHours:config.lookbackHours,minimumScore:config.minimumScore,
    sourceActivations:config.webScrapers?.sites?.filter(s=>s.alertsFrom)||[]});
  const report=buildWeeklyReport(prepared,window,config.minimumScore);
  assert.ok(report.highlights.every(isWhatsAppCategoryAllowed));
  const messages=formatWeeklyMessages(report);
  assert.ok(messages.every(m=>m.length<=3400));
  assert.equal(JSON.stringify(state),original,'Prévia semanal modificou o estado');
  previews.push({time,start:report.start,end:report.end,events:report.events,parts:messages.length,categories:report.categories});
  await writeFile(`${out}/weekly-${previews.length}.txt`,messages.join('\n\n──────────\n\n')+'\n');
}
assert.equal(previews[0].start,previews[1].start);assert.equal(previews[0].end,previews[1].end);
assert.equal(previews[0].events,previews[1].events);
assert.deepEqual(await protectedSnapshot(),before,'Acervo, sessão ou recibos foram modificados');
const report={profile,parentFlags:flags,parentFlagsUnchanged:true,protectedFilesUnchanged:true,
  productionEntrypointsRun:false,whatsappConnections:0,whatsappSends:0,apiCalls:0,weeklyPreviews:previews};
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
