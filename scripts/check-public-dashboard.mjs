import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {hydrateSnapshot,hydrateTable} from '../dashboard/src/snapshot-loader.mjs';
import {buildResults} from '../dashboard/src/results-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'dashboard', 'dist');
const [raw, versionRaw, size] = await Promise.all([
  readFile(path.join(directory, 'data.json'), 'utf8'),
  readFile(path.join(directory, 'version.json'), 'utf8'),
  stat(path.join(directory, 'data.json')),
]);
const data = JSON.parse(raw);
const version = JSON.parse(versionRaw);
if (!data.public) throw new Error('O pacote não foi gerado no modo público.');
if (data.items.some((item) => item.fullText)) throw new Error('Texto integral entrou no pacote público.');
if (data.items.some((item) => item.alternativeSources?.some(source => source.fullText)))
  throw new Error('Texto integral de fonte alternativa entrou no pacote público.');
if (version.generatedAt !== data.generatedAt || version.lastCollectionAt !== data.lastCollectionAt)
  throw new Error('Versão e dados do painel não correspondem.');
if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw) ||
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(raw) || /\b\d{10,20}@g\.us\b/.test(raw))
  throw new Error('Identificador pessoal detectado no pacote público.');
const manifestRaw=await readFile(path.join(directory,'snapshot.json'),'utf8');
const manifest=JSON.parse(manifestRaw);
if(Buffer.byteLength(manifestRaw)>1_000_000)throw new Error('Manifesto público excede 1 MB');
let totalBytes=Buffer.byteLength(manifestRaw);const checked=new Set();
const localFetch=async url=>{
  const relative=String(url).replace(/^\.\//,'');
  if(!/^parts\/(?:items|table-[a-z-]+)-[a-f0-9]{64}\.json$/.test(relative))throw new Error('Parte fora da pasta pública');
  const bytes=await readFile(path.join(directory,relative));
  if(bytes.length>2_000_000)throw new Error('Parte pública excede 2 MB');
  if(!checked.has(relative)){totalBytes+=bytes.length;checked.add(relative);}
  return new Response(bytes,{headers:{'content-type':'application/json'}});
};
const hydrated=await hydrateSnapshot(manifest,localFetch);
for(const period of ['all','30d','7d'])for(const mode of ['discovery','occurrence']){
  if(JSON.stringify(buildResults(hydrated,{period,mode}))!==JSON.stringify(buildResults(data,{period,mode})))
    throw new Error('Indicadores dependem da ordem de abertura das tabelas');
}
for(const table of hydrated.baseTables||[]){
  const loaded=await hydrateTable(table,manifest.generatedAt,localFetch);
  const original=data.baseTables.find(t=>t.id===table.id);
  if(JSON.stringify(loaded.rows)!==JSON.stringify(original?.rows))throw new Error('Linhas foram perdidas no particionamento');
}
if(JSON.stringify(hydrated.items)!==JSON.stringify(data.items)||manifest.generatedAt!==data.generatedAt)throw new Error('Publicações divergiram no particionamento');
// Keep the complete legacy file for already-open clients; new clients do not download it.
if(totalBytes>100_000_000||size.size>100_000_000)throw new Error('Acervo público excedeu orçamento de 100 MB; revisar crescimento');
if (data.items.length !== data.stats.documents + data.stats.acts)
  throw new Error('Quantidade de publicações e atos não corresponde aos registros do painel.');
console.log(`[painel] Validado sem perda: ${data.stats.documents} publicações e ${data.stats.acts} atos; manifesto ${(Buffer.byteLength(manifestRaw)/1000).toFixed(0)} KB; ${checked.size} partes, até 2 MB cada. Compatibilidade ${(size.size/1_000_000).toFixed(2)} MB.`);
