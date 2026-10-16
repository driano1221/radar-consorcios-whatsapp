// Experimental refinements only. Nothing in src/ imports this module.
import {normalizeWhitespace} from '../../src/lib/text.mjs';

export const fold = s => normalizeWhitespace(String(s || '')).normalize('NFD')
  .replace(/\p{M}/gu, '').toLowerCase();
const unsafe = /\b(?:nao|nunca|negou|teria|poderia|pretende|caso|se|supostamente)\b/;
function proof(text, expression) {
  for (const m of text.matchAll(new RegExp(expression.source, expression.flags.replace('g','')+'g'))) {
    const start = Math.max(text.lastIndexOf('.',m.index-1),text.lastIndexOf('!',m.index-1),text.lastIndexOf('?',m.index-1))+1;
    if (!unsafe.test(fold(text.slice(start,m.index)+m[0]))) return m[0];
  }
  return '';
}
export function refineShadow(item, rule) {
  const text=normalizeWhitespace(item.rawText), title=normalizeWhitespace(item.title);
  const use=(category,stage,evidence,kind)=>({...rule,category,score:category==='GERAL'?0:Math.max(5,rule.score||0),
    stage,evidenceText:evidence,proofKind:kind,reasons:[stage]});
  const indexMarker=/\b(?:lista de (?:outras )?publica[cç][oõ]es|foram encontrad[oa]s?\s+\d+\s+registros|exibindo at[eé]\s+\d+\s+publica[cç][oõ]es por p[aá]gina)\b/i.exec(text);
  if (indexMarker && ((text.match(/\bAcessar\b/gi)||[]).length>=3 || (text.match(/\bData:\s*\d/gi)||[]).length>=3))
    return use('GERAL','índice de documentos: descobrir e ler os links individuais; não registrar o mural',
      text.slice(Math.max(0,indexMarker.index-20),indexMarker.index+240),'document_index');
  // A metadata card without a dispositive/ementa is not the judgment itself.
  if (/^Detalhes do Ac[oó]rd[aã]o\b/i.test(title) && /Decis[aã]o na [ÍI]ntegra\s*\(PDF\)/i.test(text) &&
      /Classe Processual\/Assunto/i.test(text) && !/\b(?:julgou|julgar|decidiu|acordam|condenou|determinou|reprovou|regulares com ressalvas|improced[eê]ncia)\b/i.test(text))
    return use('GERAL','ficha sem resultado do julgamento; ler a decisão vinculada',text.slice(0,450),'judgment_metadata');
  if (rule.category==='GERAL') return rule; // preserve supplier, request and proposal exclusions
  const control=proof(text,/\b(?:Tribunal de Contas[^.!?]{0,100}|TCE[-–][A-Z]{2})\s+(?:reprovou|desaprovou|rejeitou|julgou)(?:,\s*em sess[aã]o[^.!?]{0,100},)?\s+(?:como\s+)?(?:irregulares\s+|regulares\s+)?(?:as?\s+)?(?:presta[cç][aã]o de\s+)?contas[^.!?]{0,160}cons[oó]rcio[^.!?]{0,140}/i);
  if (control) return use('CONTROLE','julgamento de contas relatado; preservar resultado e destinatário das sanções, sem inferir trânsito em julgado',control,'accounts_judgment');
  const investigation=proof(text,/\bA investiga[cç][aã]o [eé] conduzida pela [^.!?]{0,160}Promotoria[^.!?]{0,260}Cons[oó]rcio Intermunicipal[^.!?]{0,180}/i);
  if (investigation && /inquérito civil/i.test(text)) return use('CONTROLE',
    'inquérito civil em andamento; suspeitas não equivalem a irregularidades comprovadas ou condenação',investigation,'active_investigation');
  // Main action has a subject and a completed verb, not a generic footer
  // describing an assembly's powers. Never turn a future intention into a fact.
  if (['ATUAÇÃO','GOVERNANÇA'].includes(rule.category)) {
    const activity=proof(text,/\bCons[oó]rcio\s+(?:P[uú]blico\s+)?Intermunicipal\s+[^.!?;]{2,150}?\s+(?:deu in[ií]cio [àa] [^.!?;]{0,80}programa|recebeu,?[^.!?;]{0,75}a aula inaugural|viabilizou procedimentos)[^.!?;]{0,200}/i);
    if(activity) return use('ATUAÇÃO','atividade realizada pelo consórcio; ações futuras e entregas adicionais não presumidas',activity,'completed_activity');
  }
  return rule;
}

// Normalize presentation, not identity. No fuzzy matching, edit distance,
// municipality inference or aliases imported from the editorial registry.
export function entityProven(body, entity, quote) {
  const norm=s=>fold(s).replace(/[–—]/g,'-');
  const name=norm(entity), q=norm(quote), b=norm(body);
  if (!name || !q.includes('consorcio')) return false;
  const contains=(s,v)=>(' '+s+' ').includes(' '+v+' ') || new RegExp(`(^|[^\\p{L}\\p{N}])${v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^\\p{L}\\p{N}])`,'u').test(s);
  if(contains(q,name)) return true;
  const suffix=/^(.*?)(?:\s*\(([a-z][a-z0-9-]{1,20})\))$/.exec(name);
  if(!suffix || !contains(q,suffix[1])) return false;
  // Appended acronym is permitted ONLY if explicitly adjacent to this full
  // name elsewhere in the same document, not just present somewhere in it.
  return b.includes(suffix[1]+' ('+suffix[2]+')') || b.includes(suffix[1]+' - '+suffix[2]);
}
