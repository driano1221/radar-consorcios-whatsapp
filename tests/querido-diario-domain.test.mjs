import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile}from'node:fs/promises';
import {fetchQueridoDiario,QD_API_BASE_URL}from'../src/lib/sources/querido-diario.mjs';

test('produção usa domínio atual do QD e não o subdomínio legado sem certificado',async()=>{
  const config=JSON.parse(await readFile(new URL('../config/default.json',import.meta.url),'utf8'));
  assert.equal(config.queridoDiario.baseUrl,'https://api.queridodiario.org.br');
  assert.equal(QD_API_BASE_URL,config.queridoDiario.baseUrl);
  assert.ok(config.queridoDiario.timeoutMs>=30000);
  assert.ok(!config.queridoDiario.fallbackBaseUrls.includes('https://api.queridodiario.ok.org.br'));
});

test('coletor sem override começa pela API atual e conserva identidade do diário',async()=>{
  const urls=[];
  const result=await fetchQueridoDiario({enabled:true,retries:0,queryGroups:[['consórcio']]},new Date('2026-10-01'),async url=>{
    urls.push(url);return Response.json({gazettes:[{territory_id:'2611606',territory_name:'Recife',state_code:'PE',date:'2026-10-15',
      url:'https://data.queridodiario.ok.org.br/2611606/2026-10-15/document.pdf',excerpts:['Contrato de rateio do consórcio público.']}]});
  });
  assert.ok(urls[0].startsWith(QD_API_BASE_URL+'/gazettes?'));
  assert.equal(urls.length,1);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].source,'Querido Diário');
  assert.equal(result.items[0].territoryId,'2611606');
  assert.match(result.items[0].url,/data\.queridodiario\.ok\.org\.br/);
  assert.equal(result.diagnostics[0].endpoint,QD_API_BASE_URL);
});
