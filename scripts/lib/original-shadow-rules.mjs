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
    stage,evidenceText:evidence,proofKind:kind,policyExclusion:category==='GERAL'?kind:null,reasons:[stage]});
  const indexMarker=/\b(?:lista de (?:outras )?publica[cç][oõ]es|foram encontrad[oa]s?\s+\d+\s+registros|exibindo at[eé]\s+\d+\s+publica[cç][oõ]es por p[aá]gina)\b/i.exec(text);
  if (indexMarker && ((text.match(/\bAcessar\b/gi)||[]).length>=3 || (text.match(/\bData:\s*\d/gi)||[]).length>=3))
    return use('GERAL','índice de documentos: descobrir e ler os links individuais; não registrar o mural',
      text.slice(Math.max(0,indexMarker.index-20),indexMarker.index+240),'document_index');
  // A metadata card without a dispositive/ementa is not the judgment itself.
  if (/^Detalhes do Ac[oó]rd[aã]o\b/i.test(title) && /Decis[aã]o na [ÍI]ntegra\s*\(PDF\)/i.test(text) &&
      /Classe Processual\/Assunto/i.test(text) && !/\b(?:julgou|julgar|decidiu|acordam|condenou|determinou|reprovou|regulares com ressalvas|improced[eê]ncia)\b/i.test(text))
    return use('GERAL','ficha sem resultado do julgamento; ler a decisão vinculada',text.slice(0,450),'judgment_metadata');
  if (rule.category==='GERAL') {
    // Existing explicit editorial exclusions outrank a model's reinterpretation.
    // This is NOT a blanket veto for every low-score/GERAL classification.
    const request=/\b(?:mat[eé]ria\s*:\s*|tipo\s*:\s*REQ\s*-\s*)requerimento\b.{0,450}\b(?:solicita|requer)\b[^.!?]{0,240}/i.exec(text);
    if (/^requerimento;/.test(rule.stage||'')&&request)
      return use('GERAL',rule.stage,request[0],'request_not_authorization');
    if (/credenciamento (?:de fornecedor|rotineiro)/.test(rule.stage||'') && /credenciamento/i.test(rule.evidenceText||''))
      return use('GERAL',rule.stage,rule.evidenceText,'routine_supplier_excluded');
    if (/^crédito orçamentário;/.test(rule.stage||'') && /cr[eé]dito adicional/i.test(rule.evidenceText||''))
      return use('GERAL',rule.stage,rule.evidenceText,'budget_rubric_excluded');
    return rule;
  }
  if(rule.category==='RATEIO' && /celebração a conferir/.test(rule.stage||'') && item.kind==='gazette' &&
    !/\bminuta\b/i.test(title+' '+text)) {
    const signed=/\bresolvem celebrar o presente Contrato de Rateio\b[^.!?]{0,220}/i.exec(text);
    const closing=/\bassinam o presente Contrato\b[^.!?]{0,180}/i.exec(text);
    if(/^CONTRATO DE RATEIO/i.test(title)&&signed&&closing&&/\bPREFEITO\b[\s\S]{0,180}\bPRESIDENTE\b/i.test(text.slice(-650)))
      return use('RATEIO','instrumento de rateio celebrado conforme publicação; pagamento e execução não comprovados',signed[0],'published_rateio_instrument');
    const amendment=/\bPROCEDIMENTO ADMINISTRATIVO ADITIVO\b[^.!?]{0,100}CONTRATO DE RATEIO[^.!?]{0,90}/i.exec(text);
    if(/^EDITAL DE PUBLICA[CÇ][AÃ]O/i.test(title)&&amendment&&/CONSORCIANTE:[\s\S]{0,240}CONSORCIADO:/i.test(text)&&
      /Certifico que o ato discriminado[\s\S]{0,200}data de sua assinatura/i.test(text))
      return use('RATEIO','aditivo de rateio publicado; valor e vigência alterados, pagamento não comprovado',amendment[0],'published_rateio_amendment');
  }
  const control=proof(text,/\b(?:Tribunal de Contas[^.!?]{0,100}|TCE[-–][A-Z]{2})\s+(?:reprovou|desaprovou|rejeitou|julgou)(?:,\s*em sess[aã]o[^.!?]{0,100},)?\s+(?:como\s+)?(?:irregulares\s+|regulares\s+)?(?:as?\s+)?(?:presta[cç][aã]o de\s+)?contas[^.!?]{0,160}cons[oó]rcio[^.!?]{0,140}/i);
  if (control) return use('CONTROLE','julgamento de contas relatado; preservar resultado e destinatário das sanções, sem inferir trânsito em julgado',control,'accounts_judgment');
  const investigation=proof(text,/\bA investiga[cç][aã]o [eé] conduzida pela [^.!?]{0,160}Promotoria[^.!?]{0,260}Cons[oó]rcio Intermunicipal[^.!?]{0,180}/i);
  if (investigation && /inquérito civil/i.test(text)) return use('CONTROLE',
    'inquérito civil em andamento; suspeitas não equivalem a irregularidades comprovadas ou condenação',investigation,'active_investigation');
  const instituted=proof(text,/\bMinist[eé]rio P[uú]blico[^.!?]{0,85}\binstaurou inqu[eé]rito civil\b[^.!?]{0,230}Cons[oó]rcio[^.!?]{0,140}/i);
  if(instituted)return use('CONTROLE','inquérito civil instaurado; contratação investigada, irregularidades não comprovadas',instituted,'instituted_investigation');
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
