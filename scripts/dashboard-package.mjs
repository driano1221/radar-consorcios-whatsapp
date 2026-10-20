import {createHash} from 'node:crypto';

// Retain the complete compatibility snapshot, but new clients load bounded,
// immutable chunks and fetch base-table rows only when opening that table.
export function partitionDashboard(data,{maxBytes=1_500_000}={}) {
  const files=new Map();
  const parts=(rows,prefix)=>{
    const chunks=[];let chunk=[],bytes=100;
    for(const row of rows){
      const length=Buffer.byteLength(JSON.stringify(row))+1;
      if(length>maxBytes-100)throw new Error(`Linha grande demais em ${prefix}; não truncar informação`);
      if(chunk.length&&bytes+length>maxBytes){chunks.push(chunk);chunk=[];bytes=100;}
      chunk.push(row);bytes+=length;
    }
    if(chunk.length)chunks.push(chunk);
    return chunks.map(rows=>{
      const raw=JSON.stringify({generatedAt:data.generatedAt,rows})+'\n';
      const sha256=createHash('sha256').update(raw).digest('hex');
      const url=`parts/${prefix}-${sha256}.json`;
      files.set(url,raw);
      return {url,sha256,count:rows.length,bytes:Buffer.byteLength(raw)};
    });
  };
  const manifest={...data,formatVersion:2,items:[],itemCount:data.items.length,itemParts:parts(data.items,'items'),
    baseTables:(data.baseTables||[]).map(table=>({...table,rows:[],rowCount:table.rows.length,
      rowParts:parts(table.rows,`table-${table.id}`)}))};
  return {manifest,files};
}
