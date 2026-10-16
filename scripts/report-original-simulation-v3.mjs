// Render frozen experimental results. Does not classify, collect, apply or send.
import {readFile,writeFile} from 'node:fs/promises';
const [file,run]=process.argv.slice(2);
if(!file||!/^\d+$/.test(run||''))throw new Error('Saved report and verified run ID required');
const r=JSON.parse(await readFile(file,'utf8'));
if(!['original-shadow-3','original-shadow-3.1','original-shadow-3.2'].includes(r.version)||r.productionActivated!==false||r.whatsappCalls!==0||!r.protectedFilesUnchanged)
  throw new Error('Invalid version or missing safety evidence');
const safe=s=>String(s??'').replace(/\|/g,'/').replace(/[\r\n]+/g,' ');
const link=x=>`[${safe(x.title)}](${x.url.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
const n=(d,k)=>d?.[k]||0;
const names={original40:'40 originais',additional:'18 adicionais com referência',previous12:'12 exploratórios anteriores',new12:'12 textos diferentes adicionais'};
const chosen=r.results.filter(x=>x.selectedForAi),pending=chosen.filter(x=>x.proposal.decision==='pendente');
const c=r.counts;
const tag=r.version.endsWith('3.2')?'V32':r.version.endsWith('3.1')?'V31':'V3';
const md=`# Simulação ${r.version} — regras, prova e republicações

**Não ativada.** Comparação com a execução v2.1 [38959557626](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38959557626). O complemento CONSUD v2.2 permanece documentado separadamente. Acervo, painel e estado de envio não foram alterados.

${r.replaySource?`**Replay determinístico de todas as respostas congeladas**, não uma nova rodada de IA. Origem: [${r.replaySource.run}](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/${r.replaySource.run}), commit ${r.replaySource.commit}, política de leitura ${r.replaySource.readingVersion}. Os 82 vínculos e hashes foram conferidos. Nenhuma resposta foi substituída, nem selecionada por resultado. Uma resposta inválida do mural está preservada; a regra explícita de mural sustenta seu descarte sem depender da IA.`:''}

## Antes e depois

| Grupo | Antes: aceitar / descartar / reter | Agora: aceitar / descartar / reter |
| --- | ---: | ---: |
${Object.entries(r.cohorts).map(([key,x])=>`| ${names[key]} | ${key==='new12'?'Não testado':`${n(x.before,'aceito')} / ${n(x.before,'descartado')} / ${n(x.before,'pendente')}`} | ${n(x.after,'aceito')} / ${n(x.after,'descartado')} / ${n(x.after,'pendente')} |`).join('\n')}

Nas 58 referências de mesma fonte: **${c.aiDecisionAgreements} decisões concordantes**, ${c.aiDecisionDisagreements} divergências de aceite/descarte e ${c.aiAcceptedCategoryDisagreements} divergências de categoria nos aceites. Isso mede regressão sobre casos conhecidos, não acurácia universal nem verificação de todos os campos.

As 12 leituras exploratórias anteriores agora são casos conhecidos, não holdout. As outras 12 foram congeladas por ID/hash antes da chamada de IA, sem repetir nenhum corpo dos 70 anteriores. São textos já arquivados, não notícias coletadas hoje. Seleção estratificada: seis positivos/seis negativos pela regra de produção. A inspeção posterior do assistente não equivale a validação humana independente.

## Mudanças implementadas somente no protótipo

1. Uma leitura de IA por corpo integral e versão da política. Títulos e veículos diferentes não mudam o input da IA; cada URL preserva seu próprio vínculo e proveniência. Falha também é compartilhada, sem repetir até obter uma resposta favorável.
2. Rótulos próximos só podem ser normalizados quando regra e IA demonstram o mesmo tipo de fato com prova literal específica: histórico de constituição, alteração de protocolo ou recomendação entregue. Uma citação genérica não passa só porque contém o nome do consórcio.
3. Oficinas/curso/seminário efetivamente sediados e ordens judiciais dirigidas a consórcio público têm regras próprias. Futuro, negação, presença passiva e chamadas de notícias relacionadas não sustentam o aceite.
4. Contrato municipal com consórcio empresarial não vira punição ao consórcio público que gerencia a ata citada.
5. Notícia que enumera processos diferentes recebe segmentação com número e offsets no texto original. Segmentação ainda não equivale a decisões autônomas validadas: o registro agregado continua retido quando a identificação ou o dispositivo não é seguro.
6. Checagem adicional impede decisões conflitantes para corpos idênticos. Não houve escrita na base nem fusão automática de fatos. Igualdade de corpo não resolve sozinha republicações com textos diferentes.

## Replay e limites

- ${c.archive} publicações; ${c.storedFulltext} textos completos armazenados; ${c.eligible} elegíveis para este piloto de originais HTML.
- Regras versus referências: ${c.ruleAgreements}/${c.comparable}; falsos aceites ${c.ruleFalseAccepts}; falsos descartes ${c.ruleFalseRejects}; categorias divergentes ${c.categoryDisagreements}.
- ${c.aiSelected} documentos, ${c.aiCalls} chamadas novas; ${c.aiErrors} falhas novas; ${c.savedResponseErrors||0} falhas preservadas nas respostas reutilizadas; ${c.sharedBodyGroups} grupo(s) de corpos repetidos; ${c.inconsistentGroups} grupo(s) com divergência de regras retida pela proteção.
- ${c.usage.input} tokens de entrada e ${c.usage.output} de saída, contados por chamada única, não por URL.
- PDF, OCR, textos alternativos e íntegra ausente estão fora deste piloto. Sua exclusão da avaliação não significa descarte temático.
- Aceitar conteúdo não significa inserir fato novo: há republicações e acontecimentos já registrados. A deduplicação semântica completa ainda não foi ativada por este experimento.

## Pendências da execução

${pending.map(x=>`- ${link(x)} — ${safe(x.proposal.reason)}. Regra: ${x.ruleCategory}; IA: ${safe(x.ai?.answer?.categoria)} / ${safe(x.ai?.answer?.tipo_fato)}. ${safe(x.ai?.answer?.justificativa)}`).join('\n')||'Nenhuma nesta amostra; isso não prova cobertura universal.'}

## Comparação documento a documento

| Publicação | Grupo | Antes | Proposta agora | Prova / motivo |
| --- | --- | --- | --- | --- |
${chosen.map(x=>`| ${link(x)} | ${names[x.cohort]} | ${x.beforeProposal?.decision||'Não testado'} | ${x.proposal.decision} ${safe(x.proposal.category)} | ${safe(x.proposal.reason)} — ${safe(x.proposal.evidence)} |`).join('\n')}

## Segmentação experimental de processos

${chosen.filter(x=>x.processSegments?.length).map(x=>`${link(x)}\n\n| Processo | Intervalo no texto (fim exclusivo) | Dispositivo explícito no trecho? | Limite |\n| --- | --- | --- | --- |\n${x.processSegments.map(s=>`| ${s.process} | ${s.start}–${s.end} | ${s.hasDispositive?'Sim':'Não'} | ${safe(s.limitation)||'Preservar entidade e verificar evidência antes de decisão autônoma'} |`).join('\n')}`).join('\n')}

## Rastreabilidade

- [Actions ${run}](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/${run}), commit ${r.commit}.
- Gerado ${r.generatedAt}; snapshot ${r.corpusHash}.
- Artefato original-triage-simulation-v3 contém íntegra dos resultados e respostas. Este resumo preserva todos os casos testados.
- Zero chamadas WhatsApp. Workflow sem credenciais de envio e sem modo apply; hashes de data/state conferidos antes/depois; diff de data/state/config/src conferido no CI.
- Branch experimental test/original-triage-simulation. Nenhuma alteração no main, nem publicação de novas decisões no painel.
`;
await writeFile('docs/SIMULACAO-ORIGINAIS-'+tag+'-2026-10-16.md',md);
await writeFile('docs/simulacao-originais-'+tag.toLowerCase()+'-2026-10-16-resumo.json',JSON.stringify({version:r.version,run,commit:r.commit,
  generatedAt:r.generatedAt,corpusHash:r.corpusHash,counts:c,cohorts:r.cohorts,replaySource:r.replaySource,productionActivated:false,
  whatsappCalls:0,protectedFilesUnchanged:true,sample:chosen.map(x=>({id:x.id,textHash:x.textHash,url:x.url,title:x.title,cohort:x.cohort,
    reference:x.referenceDecision,referenceCategory:x.referenceCategory,before:x.beforeProposal,rule:x.ruleCategory,
    proposal:x.proposal,ai:x.ai?.answer,contentReviewKey:x.ai?.contentReviewKey,duplicateCandidate:x.duplicateCandidate,
    processSegments:x.processSegments}))},null,2));
console.log(JSON.stringify({cohorts:r.cohorts,pending:pending.length,counts:c},null,2));
