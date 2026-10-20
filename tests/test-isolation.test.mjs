import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {isolatedTestEnvironment} from '../scripts/isolated-environment.mjs';

test('ambiente dos testes desliga efeitos e remove credenciais sem mudar o processo de produção',()=>{
  const parent={PATH:'path',CI:'true',SEND_ENABLED:'true',PERSIST_STATE:'true',AI_REVIEW_ENABLED:'true',AI_PREVIEW:'true',
    BOT_STATE_PASSWORD:'fixture',DEEPSEEK_API_KEY:'fixture',WHATSAPP_GROUP_ID:'fixture',WHATSAPP_WEEKLY_GROUP_ID:'fixture',
    GITHUB_TOKEN:'fixture',GH_TOKEN:'fixture',whatsapp_secret:'fixture',send_enabled:'true'};
  const before=JSON.stringify(parent),child=isolatedTestEnvironment(parent);
  for(const key of ['SEND_ENABLED','PERSIST_STATE','AI_REVIEW_ENABLED','AI_PREVIEW'])assert.equal(child[key],'false');
  assert.equal(child.CI,'true');assert.equal(child.PATH,'path');
  assert.ok(!('send_enabled' in child));
  for(const key of ['BOT_STATE_PASSWORD','DEEPSEEK_API_KEY','WHATSAPP_GROUP_ID','WHATSAPP_WEEKLY_GROUP_ID','GITHUB_TOKEN','GH_TOKEN','whatsapp_secret'])assert.ok(!(key in child));
  assert.equal(JSON.stringify(parent),before);
});
test('manutenção continua recusando envio e persistência mesmo após isolar o executor dos testes',()=>{
  for(const [send,persist,reason]of [['true','true','não aceita envio'],['true','false','não aceita envio'],['false','true','não persiste estado']]){
    const child=spawnSync(process.execPath,['scripts/review-historical-188.mjs'],{
      env:{...isolatedTestEnvironment(),SEND_ENABLED:send,PERSIST_STATE:persist},encoding:'utf8',windowsHide:true});
    assert.equal(child.status,1);assert.ok(child.stderr.includes(reason));
  }
});
test('radar e resumo isolam só os passos de teste, preservando configuração real dos disparos',async()=>{
  for(const [file,names]of [['radar',['Testes de regressão','Validar base após a coleta']],['weekly',['Testes de regressão']]]){
    const text=await readFile(`.github/workflows/${file}.yml`,'utf8');
    assert.match(text,/SEND_ENABLED: \$\{\{/);
    for(const name of names){
      const start=text.indexOf(`- name: ${name}`);assert.ok(start>=0);
      const block=text.slice(start).split(/\n      - /)[0];
      assert.match(block,/SEND_ENABLED: 'false'/);assert.match(block,/PERSIST_STATE: 'false'/);
      assert.match(block,/AI_REVIEW_ENABLED: 'false'/);assert.match(block,/AI_PREVIEW: 'false'/);
      assert.match(block,/run: npm test/);
    }
    assert.match(text,/if: (?:steps\.freshness\.outputs\.run == 'true' && )?env\.SEND_ENABLED == 'true'/);
  }
});
