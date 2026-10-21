import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadConfig} from '../src/config.mjs';
import {loadState,saveState} from '../src/lib/dedupe.mjs';

// The workflow calls this only after catalog validation, keeping receipts and cursors independent on failure.
export async function commitGazetteCursors(config){
  assert.equal(config.persistState,true,'Gravação de marcadores desabilitada');
  const cursors=JSON.parse(await readFile(path.join(config.outputDir,'gazette-cursors.json'),'utf8'));
  assert.ok(cursors&&typeof cursors==='object'&&!Array.isArray(cursors),'Plano de marcadores inválido');
  const sites=new Map(config.webScrapers.sites.filter(s=>s.resumePagination===true).map(s=>[s.url,s]));
  for(const [url,cursor] of Object.entries(cursors)){
    assert.ok(sites.has(url),'Marcador fora dos portais configurados');
    assert.equal(cursor.query,sites.get(url).query||'consórcio');
    assert.ok(Number.isSafeInteger(cursor.nextPage)&&cursor.nextPage>0&&Array.isArray(cursor.pending));
  }
  if(Object.keys(cursors).length){
    const state=await loadState(config.stateFile);
    state.gazetteCursors={...(state.gazetteCursors||{}),...cursors};
    await saveState(config.stateFile,state);
  }
  return cursors;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const cursors=await commitGazetteCursors(await loadConfig());
  console.log(`[diários] ${Object.keys(cursors).length} marcador(es) confirmado(s) após validar o acervo.`);
}
