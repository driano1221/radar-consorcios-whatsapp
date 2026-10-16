// Experimental refinements only. Nothing in src/ imports this module.
import {normalizeWhitespace} from '../../src/lib/text.mjs';

export const fold = s => normalizeWhitespace(String(s || '')).normalize('NFD')
  .replace(/\p{M}/gu, '').toLowerCase();
const unsafe = /\b(?:nao|nunca|negou|teria|poderia|pretende|caso|se|supostamente)\b/;
function proof(text, expression) {
  for (const m of text.matchAll(new RegExp(expression.source, expression.flags.replace('g','')+'g'))) {
    const start = Math.max(text.lastIndexOf('.',m.index-1),text.lastIndexOf('!',m.index-1),text.lastIndexOf('?',m.index-1))+1;
    if (!unsafe.test(fold(text.slice(start,m.index)+m[0])) && !/leia tamb[eé]m\s*:/i.test(text.slice(start,m.index))) return m[0];
  }
  return '';
}
export function refineShadow(item, rule) {
  const text=normalizeWhitespace(item.rawText), title=normalizeWhitespace(item.title);
  const use=(category,stage,evidence,kind)=>({...rule,category,score:category==='GERAL'?0:Math.max(5,rule.score||0),
    stage,evidenceText:evidence,proofKind:kind,policyExclusion:category==='GERAL'?kind:null,reasons:[stage]});
  // User decision 16/10: routine tariff recompositions remain outside. This
  // does NOT exclude new general inspection rules or consortium governance.
  const tariff=/\bFica homologada,?[^.!?;]{0,160}\brecomposi[cç][aã]o do equil[ií]brio econ[oô]mico-financeiro[^.!?;]{0,230}\btarifas\b[^.!?;]{0,140}/i.exec(text);
  if(/^RESOLU[CÇ][AÃ]O/i.test(title) && tariff && /Contrato de Cons[oó]rcio P[uú]blico/i.test(text))
    return use('GERAL','recomposição tarifária rotineira excluída por critério editorial; não confundir com nova norma institucional',tariff[0],'routine_tariff');
  const indexMarker=/\b(?:lista de (?:outras )?publica[cç][oõ]es|foram encontrad[oa]s?\s+\d+\s+registros|exibindo at[eé]\s+\d+\s+publica[cç][oõ]es por p[aá]gina)\b/i.exec(text);
  if (indexMarker && ((text.match(/\bAcessar\b/gi)||[]).length>=3 || (text.match(/\bData:\s*\d/gi)||[]).length>=3))
    return use('GERAL','índice de documentos: descobrir e ler os links individuais; não registrar o mural',
      text.slice(Math.max(0,indexMarker.index-20),indexMarker.index+240),'document_index');
  // A metadata card without a dispositive/ementa is not the judgment itself.
  if (/^Detalhes do Ac[oó]rd[aã]o\b/i.test(title) && /Decis[aã]o na [ÍI]ntegra\s*\(PDF\)/i.test(text) &&
      /Classe Processual\/Assunto/i.test(text) && !/\b(?:julgou|julgar|decidiu|acordam|condenou|determinou|reprovou|regulares com ressalvas|improced[eê]ncia)\b/i.test(text))
    return use('GERAL','ficha sem resultado do julgamento; ler a decisão vinculada',text.slice(0,450),'judgment_metadata');
  // User policy (16/10): secondary-source institutional history can be kept,
  // even inside recruitment news. It is NOT verification of the original act.
  if(item.kind==='news'&&/\b(?:concurso|processo seletivo)\b/i.test(title)) {
    const historical=/\bCons[oó]rcio Intermunicipal[^.!?;]{2,170}?,?\s+(?:estabelecido|constitu[ií]do|criado)\s+em\s+(?:\d{1,2}\s+de\s+[a-zç]+\s+de\s+)?(20\d{2}),\s+[^.!?;]{0,90}entidade p[uú]blica[^.!?;]{0,200}/i;
    const evidence=proof(text,historical), year=evidence&&historical.exec(evidence)?.[1];
    if(evidence&&year&&!/\b(?:seria|sera|seriam|serao|previsto|prevista)\b/.test(fold(evidence)))return {...use('CRIAÇÃO',`constituição relatada em ${year} por fonte secundária; ato original não conferido; concurso não é o fato`,evidence,'secondary_institutional_history'),
      sourceQualification:'fonte_secundaria_ato_original_nao_conferido',reportedYear:Number(year)};
  }
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
  }
  const future=/\b(?:semin[aá]rio|evento|oficina)[^.!?]{0,180}\b(?:ocorrer[aá]|ser[aá] realizado)(?=\s|[,.;])[^.!?]{0,220}/i.exec(text);
  if(rule.category==='GERAL' && future && !/\b(?:sediou|realizou|aconteceu|foi realizado|firmou|firmada|assinou)\b/i.test(text))
    return use('GERAL','evento apenas anunciado; data transcorrida e apoio não comprovam realização',future[0],'future_event_only');
  const routine=/\b(?:termos? de credenciamento)[^.!?]{0,180}\b(?:preveem|prev[eê])\b[^.!?]{0,180}/i.exec(text);
  if(item.kind==='news' && /credenciamentos?/i.test(title) && routine && /(?:hospital|laborat[oó]rio)/i.test(text) &&
    !proof(text,/\b(?:Cons[oó]rcio|hospital|laborat[oó]rio)[^.!?]{0,90}\b(?:realizou|prestou|realizaram|prestaram)\b[^.!?]{0,100}\b(?:atendimentos|consultas|exames)\b/i))
    return use('GERAL','credenciamento rotineiro de fornecedores; capacidade contratada e previsão financeira não comprovam atendimentos',routine[0],'routine_supplier_news');
  const partnership=/\bparceria entre o Cons[oó]rcio Intermunicipal[^.!?]{0,200}/i.exec(text);
  const signed=/\bFirmada em [a-zç]+, a parceria prev[eê][^.!?]{0,170}/i.exec(text);
  if(item.kind==='news' && partnership && signed && signed.index>partnership.index && signed.index-partnership.index<600 &&
      (text.match(/\bparceria entre\b/gi)||[]).length===1 && !/\b(?:seria|ser[aá]|a ser|n[aã]o)\s+firmada\b/i.test(text))
    return use('ATUAÇÃO','parceria já firmada relatada como contexto; inscrições futuras não são bolsas entregues; verificar duplicidade do acordo',
      text.slice(partnership.index,signed.index+signed[0].length),'signed_partnership_context');
  // Require an actual action and its public-consortium subject/target in the
  // same sentence. Neither passive attendance nor a future event qualifies.
  const workshop=proof(text,/\bCons[oó]rcio\s+(?:P[uú]blico\s+)?Intermunicipal\s+[^.!?;]{2,120}?\s+sediou,?\s+[^.!?;]{0,90}\b(?:oficina|curso|semin[aá]rio)\b[^.!?;]{0,180}/i);
  if(workshop)return use('ATUAÇÃO','oficina/curso/seminário efetivamente sediado pelo consórcio; resultados futuros não presumidos',workshop,'hosted_activity');
  const judicial=proof(text,/\b(?:a Justi[cç]a|o ju[ií]zo|o Tribunal)\s+determinou\s+que\s+[^.!?;]{0,120}Cons[oó]rcio Intermunicipal[^.!?;]{0,180}\b(?:promovam|promova|regularize|realize|providencie)\b[^.!?;]{0,170}/i);
  if(judicial)return use('CONTROLE','ordem judicial relatada; obrigações e prazos de cada destinatário separados; trânsito em julgado não comprovado',judicial,'judicial_order');
  const amendment=proof(text,/\bFica ratificado o Termo de Altera[cç][aã]o do Protocolo de Inten[cç][oõ]es[^.!?;]{0,300}Cons[oó]rcio Intermunicipal[^.!?;]{0,150}/i);
  if(amendment && !/\b(?:projeto de lei|minuta)\b/i.test(title) && /\b(?:SANCIONADA|Registrada e publicada)\b/i.test(text))
    return use('GOVERNANÇA','lei ratifica alteração de protocolo de consórcio existente; não prova novo ingresso nem constituição',amendment,'protocol_amendment');
  const recommendation=proof(text,/\bAo final da audi[eê]ncia, foi entregue aos participantes a Recomenda[cç][aã]o n[º°.]\s*\d+\/20\d{2},\s*assinada pelas?[^.!?;]{0,150}Promotorias[^.!?;]{0,120}/i);
  if(recommendation && /Cons[oó]rcio Intermunicipal/i.test(text) && /Minist[eé]rio P[uú]blico/.test(text))
    return use('CONTROLE','recomendação do Ministério Público entregue; providências solicitadas, não condenação nem dissolução consumada',recommendation,'delivered_recommendation');
  // A payment freeze on a municipal contract is not automatically a sanction
  // on the public consortium merely managing the referenced price register.
  const municipalContract=proof(text,/\bcontrato de [^.!?]{0,150}firmado pela Secretaria Municipal[^.!?]{0,120}/i);
  const ataOnly=proof(text,/\bteve origem em ades[aã]o [àa] Ata de Registro de Pre[cç]os[^.!?]{0,75}gerenciada pelo Cons[oó]rcio Intermunicipal[^.!?]{0,150}/i);
  if(rule.category==='GERAL' && municipalContract && ataOnly && /\bempresas que o integram\b/i.test(text) &&
      (text.match(/Cons[oó]rcio Intermunicipal/gi)||[]).length===1 &&
      /\badministra[cç][aã]o municipal fica impedida de realizar novos desembolsos\b/i.test(text))
    return use('GERAL','cautelar sobre contrato municipal com consórcio empresarial; consórcio público citado como gerenciador da ata, sem sanção própria comprovada',municipalContract,'municipal_supplier_control');
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
