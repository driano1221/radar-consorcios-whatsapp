import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import path from'node:path';

export function approvedWeeklyMessages(items,start,end){
  const date=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(new Date(value));
  const lines=['🗞️ *RADAR CONSÓRCIOS*',`*Resumo semanal de ${date(end)}*`,
    `Período: ${date(start)} às 9h a ${date(end)} às 9h (Brasília).`,
    `*${items.length} publicações confirmadas.* Datas de publicação.`,''];
  for(const[key,label]of[['ATUAÇÃO','Atuação'],['RATEIO','Rateio'],['PROTOCOLO','Protocolo']]){
    const selected=items.filter(i=>key==='ATUAÇÃO'?['ATUAÇÃO','GOVERNANÇA','FINANÇAS'].includes(i.category):i.category===key);
    if(!selected.length)continue;
    const governance=key==='ATUAÇÃO'?selected.filter(i=>i.category==='GOVERNANÇA').length:0;
    lines.push(`*${label} — ${selected.length} publicações${governance?`, incluindo ${governance} de Governança`:''}*`,'');
    for(const item of selected)lines.push(`• *${date(item.date)}* · ${item.label}`,item.url,'');
  }
  lines.push('Publicação de instrumento não comprova pagamento ou execução. Subscrição e ratificação de protocolo não comprovam ingresso homologado.');
  return[lines.join('\n')];
}

export async function readApprovedWeekly(root,file){
  if(!/^data\/weekly-approved\/\d{4}-\d{2}-\d{2}\.json$/.test(file))throw Error('Arquivo de edição aprovada inválido.');
  const edition=JSON.parse(await readFile(path.join(root,file),'utf8'));
  if(edition.version!==1||!Array.isArray(edition.items)||!edition.items.length||edition.items.length>100||
    new Set(edition.items.map(i=>i.id)).size!==edition.items.length||
    Date.parse(edition.end)-Date.parse(edition.start)!==7*86400000)throw Error('Edição aprovada inválida.');
  return edition;
}

export async function loadApprovedWeekly(root,file,eligible){
  const edition=await readApprovedWeekly(root,file);
  const byId=new Map(eligible.map(i=>[i.weeklyEvidence?.documentId,i]));
  for(const item of edition.items){
    const current=byId.get(item.id);
    if(!current||current.triage?.status!=='confirmado'||current.triage.category!==item.category||
      current.triage.bodyHash!==item.bodyHash||current.weeklyDate!==item.date||current.url!==item.url||
      !['ATUAÇÃO','GOVERNANÇA','FINANÇAS','RATEIO','PROTOCOLO'].includes(item.category)||!item.label?.trim())
      throw Error('Uma publicação aprovada mudou ou deixou de ser elegível; conferir antes do envio.');
  }
  const messages=approvedWeeklyMessages(edition.items,edition.start,edition.end);
  if(createHash('sha256').update(JSON.stringify(messages)).digest('hex')!==edition.messagesSha256)
    throw Error('Texto aprovado não corresponde ao hash da edição.');
  return{...edition,messages,highlights:edition.items.map(i=>({...byId.get(i.id),presentationTitle:i.label}))};
}
