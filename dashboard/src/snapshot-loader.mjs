const safePart=/^parts\/(?:items|table-[a-z-]+)-[a-f0-9]{64}\.json$/;
export async function loadParts(parts,generatedAt,fetchImpl=fetch){
  if(!Array.isArray(parts))throw new Error('Lista de partes inválida');
  const output=new Array(parts.length);let next=0;
  await Promise.all(Array.from({length:Math.min(4,parts.length)},async()=>{
    while(next<parts.length){
      const index=next++,part=parts[index];
      if(!safePart.test(part.url)||!Number.isInteger(part.count)||part.count<0||
        !Number.isInteger(part.bytes)||part.bytes<1||part.bytes>2_000_000||!/^[a-f0-9]{64}$/.test(part.sha256)||
        !part.url.endsWith(`-${part.sha256}.json`))throw new Error('Parte fora do formato público');
      const response=await fetchImpl('./'+part.url,{cache:'force-cache',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`Falha ao abrir parte: HTTP ${response.status}`);
      const raw=await response.text();
      const bytes=new TextEncoder().encode(raw);
      const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(bytes.length!==part.bytes||sha!==part.sha256)throw new Error('Integridade da parte não confere');
      const body=JSON.parse(raw);
      if(body.generatedAt!==generatedAt||!Array.isArray(body.rows)||body.rows.length!==part.count)throw new Error('Versão ou contagem da parte não confere');
      output[index]=body.rows;
    }
  }));
  return output.flat();
}
export async function hydrateSnapshot(data,fetchImpl=fetch){
  if(data.formatVersion!==2)return data;
  const items=await loadParts(data.itemParts,data.generatedAt,fetchImpl);
  if(items.length!==data.itemCount||new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Contagem ou identidade das publicações não confere');
  // Results depend on these two small tables. Hydrate them atomically with the
  // snapshot, even when the user opens Results before visiting the base tabs.
  const baseTables=await Promise.all((data.baseTables||[]).map(table=>
    ['eventos','participacoes'].includes(table.id)?hydrateTable(table,data.generatedAt,fetchImpl):table));
  return {...data,items,baseTables};
}
export async function hydrateTable(table,generatedAt,fetchImpl=fetch){
  if(!table.rowParts||table.rowsLoaded)return table;
  const rows=await loadParts(table.rowParts,generatedAt,fetchImpl);
  if(rows.length!==table.rowCount)throw new Error('Contagem da tabela não confere');
  return {...table,rows,rowsLoaded:true};
}
export async function fetchSnapshot(version='',fetchImpl=fetch){
  const suffix=version?`?version=${encodeURIComponent(version)}`:'';
  let response=await fetchImpl('./snapshot.json'+suffix,{cache:'no-store'});
  if(response.status===404)response=await fetchImpl('./data.json'+suffix,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return hydrateSnapshot(await response.json(),fetchImpl);
}
