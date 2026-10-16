// Shadow-only refinements. Preserve the previous answer and never reroll it.
import {decideV6,VERSION} from './original-v6.mjs';
import {locateQuote} from './original-v5.mjs';
import {sha} from './original-triage-shadow.mjs';
import {entityProven,fold} from './original-shadow-rules.mjs';
const unsafe=/\b(?:n[aã]o|nunca|teria|seria|poderia|supostamente|caso|se)\b/i;
export function refineV7(p,review,proposal){
  if(!p.eligible||p.segments.length)return proposal;
  const body=p.item.rawText.trim(),a=review?.answer;
  if(body.length<350&&/[\p{L}\p{N}]$/u.test(body))return {decision:'pendente',reason:'texto_curto_sem_fechamento_recuperar_integra',reading:'v7_safety'};
  if(proposal.decision==='aceito'&&p.rule.proofKind==='signed_municipal_protocol'){
    const titleState=/Munic[ií]pios d[eo] ([\p{L} ]{2,35}) assinam/iu.exec(p.item.title)?.[1];
    const bodyState=/^Prefeitos de \d+ Munic[ií]pios d[eo] ([\p{L} ]{2,35}),/iu.exec(body)?.[1];
    if(titleState&&bodyState&&fold(titleState)!==fold(bodyState))return {decision:'pendente',reason:'titulo_e_corpo_divergem_na_localizacao_do_protocolo',reading:'v7_safety',
      provenanceWarning:{titleState,bodyState,note:'Validar vínculo do texto com a URL original; eventual revisão por fonte alternativa permanece separada.'}};
  }
  if(proposal.decision==='aceito'&&/^chamamento p[uú]blico aberto/i.test(proposal.stage||'')){
    const q=locateQuote(body,a?.evidencia);
    if(!q||!/(?:recebe a documenta[cç][aã]o|(?:abriu|publicou|lan[cç]ou|torna p[uú]blico)[^.!?]{0,100}chamamento)/i.test(q.text))
      return {decision:'pendente',reason:'prova_da_ia_nao_sustenta_chamamento_atual',reading:'v7_safety',modelEvidence:a?.evidencia};
  }
  if(proposal.reason!=='etapa_ou_prova_da_regra_insuficiente'||p.rule.category!=='GOVERNANÇA'||
    review?.version!==VERSION||review.textHash!==p.textHash||review.inputHash!==p.inputHash||
    (review.contentReviewKey&&review.contentReviewKey!==sha(VERSION+'\n'+p.item.rawText))||
    !a||a.incerto!==false||a.multiplos_atos!==false||a.relevante!==true||a.categoria!=='GOVERNANÇA')return proposal;
  const q=locateQuote(body,a.evidencia);
  const completed=/foi (?:reconduzido|reeleito|eleito) [aà] presid[eê]ncia do Cons[oó]rcio (?:P[uú]blico )?Intermunicipal[^.!?]{3,200}\.\s*A escolha ocorreu durante Assembleia Geral do Cons[oó]rcio/i;
  const corroboration=/[^.!?]{0,160}\bencabe[cç]ou a chapa [uú]nica apresentada na elei[cç][aã]o e foi escolhido por unanimidade[^.!?]{0,120}[.!?]/i.exec(body);
  if(!q||!completed.test(q.text)||unsafe.test(q.text)||!corroboration||unsafe.test(corroboration[0])||!entityProven(body,a.entidade,q.text))return proposal;
  const amended={...p,rule:{...p.rule,evidenceText:q.text,stage:'eleição realizada; mandato futuro não significa posse já ocorrida'}};
  // The model's own main quote names the same entity literally. Never infer
  // identity from the title, registry, or the model's non-literal ellipsis.
  const result=decideV6(amended,{...review,answer:{...a,evidencia_entidade:q.text}});
  return result.decision==='aceito'?{...result,reason:'Reeleição/eleição já realizada em assembleia, corroborada por escolha unânime. Não comprova posse, início do mandato futuro nem alteração do estatuto.',
    modelReason:a.justificativa,identityEvidenceOrigin:'citacao_principal_da_ia_com_entidade_literal',factType:'eleicao_realizada',reading:'v7_shadow',supportEvidence:[locateQuote(body,corroboration[0])].filter(Boolean)}:proposal;
}
