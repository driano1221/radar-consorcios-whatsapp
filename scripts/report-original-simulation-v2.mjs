// Report renderer only: consumes saved evidence, does not classify or apply.
import {readFile,writeFile} from 'node:fs/promises';
const [file,run]=process.argv.slice(2);
if(!file || !/^\d+$/.test(run||''))throw new Error('Provide saved report and verified Actions run ID.');
const r=JSON.parse(await readFile(file,'utf8'));
const old=JSON.parse(await readFile('docs/simulacao-originais-2026-10-16-resumo.json','utf8'));
if(!/^original-shadow-2(?:\.1)?$/.test(r.version)||r.productionActivated!==false||r.whatsappCalls!==0||!r.protectedFilesUnchanged)
  throw new Error('Missing safety evidence');
const safe=s=>String(s||'').replace(/\|/g,'/').replace(/[\r\n]+/g,' ');
const link=x=>`[${safe(x.title)}](${x.url.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
const labels={divergencia_regra_ia:'Regra e IA discordaram',etapa_ou_prova_da_regra_insuficiente:'Etapa ou prova insuficiente',
  identidade_sem_prova_literal:'Identidade sem prova literal',multiplos_atos:'Atos independentes apontados',
  incerteza_da_segunda_leitura:'IA não concluiu',prova_literal_ausente:'Citação sem correspondência literal',
  processos_independentes_no_corpo:'Notícia reúne processos independentes; separar antes de gerar fatos',segunda_leitura_falhou:'Falha da chamada de IA'};
const label=d=>({aceito:'Aceitar',descartado:'Descartar',pendente:'Reter'})[d]||'Sem referência';
const n=(obj,key)=>obj[key]||0;
const c=r.counts, a=r.cohorts.original40, b=r.cohorts.additional;
const chosen=r.results.filter(x=>x.selectedForAi), pending=chosen.filter(x=>x.proposal.decision==='pendente');
const actualChanged=r.results.filter(x=>x.eligible&&x.ruleCategory!==x.unchangedRuleCategory);
const header=`# Segunda simulação de originais — antes/depois e casos adicionais

**Simulação, sem ativação.** Este relatório compara o protótipo anterior com o corrigido nos mesmos 40 documentos e testa ${b.total} documentos adicionais com IA pela primeira vez neste experimento.

## Resultado nos mesmos 40

| Resultado | Protótipo anterior | Protótipo corrigido |
| --- | ---: | ---: |
| Aceitar | ${n(a.before,'aceito')} | ${n(a.after,'aceito')} |
| Descartar | ${n(a.before,'descartado')} | ${n(a.after,'descartado')} |
| Sem conclusão automática | ${n(a.before,'pendente')} | ${n(a.after,'pendente')} |
| Cobertura de decisão | 52,5% | ${((a.total-n(a.after,'pendente'))/a.total*100).toFixed(1).replace('.',',')}% |
| Aceite/descarte divergente da referência | 0 entre 21 decididos | ${a.verdictErrors} |
| Categoria divergente nos aceites | 0 | ${a.categoryErrors} |

O antes é o **protótipo da simulação anterior**, não a base publicada. Os aceites simulados não são novos fatos adicionados. A produção e o painel não foram alterados.

## Casos adicionais

- ${b.total} documentos adicionais: ${n(b.after,'aceito')} aceites, ${n(b.after,'descartado')} descartes e ${n(b.after,'pendente')} retidos.
- ${b.verdictErrors} divergências de aceite/descarte entre os decididos; ${b.categoryErrors} categorias divergentes nos aceites.
- São novos **para este teste de IA**, não notícias recém-coletadas. A seleção inclui todos os elegíveis revisados de mesma fonte que faltavam na rodada anterior, sem escolher resultados favoráveis.
- Não são um holdout independente: as regras já haviam sido comparadas às 58 referências e alguns casos foram usados nos ajustes após a primeira repetição. Não há garantia de acerto sobre notícias futuras.

## Amostra nova sem referência editorial

${r.cohorts.fresh12?`Foram também selecionados ${r.cohorts.fresh12.total} textos sem revisão editorial anterior, com semente fixa, seis relevantes e seis não relevantes segundo a regra. Seleção antes de ler seus textos/respostas. Resultado: ${n(r.cohorts.fresh12.after,'aceito')} aceites, ${n(r.cohorts.fresh12.after,'descartado')} descartes, ${n(r.cohorts.fresh12.after,'pendente')} retidos. Eles NÃO entram na taxa de concordância: não há resposta editorial anterior. A inspeção posterior é exploratória, não validação humana independente.`:'Não executada nesta rodada.'}

## O que mudou

1. Grafia de nomes: comparação tolera caixa e acentos; sigla adicionada só vale com vínculo explícito ao nome no mesmo corpo. A citação continua literal, sem normalizar texto inventado.
2. Índices/murais: não se tornam um único fato de rateio ou adesão; servem para descobrir documentos individuais. Ficha de acórdão sem resultado não prova julgamento.
3. Fato principal: início de programa/curso/atendimento não herda GOVERNANÇA de rodapé genérico. Julgamento de contas é CONTROLE, não FINANÇAS.
4. Etapas: prova do fato e estágio são obrigatórios; "celebração a conferir" não libera aceite. Requerimento aprovado não vira lei; investigação não vira condenação.
5. IA: leitura sem categoria/etapa da regra e sem respostas editoriais. Instruções distinguem composição municipal de simples nome da entidade, alteração de protocolo de subscrição inicial e efeitos da mesma norma de atos independentes.
6. Vetos explícitos (mural, ficha sem decisão, requerimento, contrato rotineiro e rubrica genérica), com prova literal, não podem ser revogados pela IA. Falta de evidência da IA só admite trecho literal da regra para descarte concordante, nunca para aceite.
7. Detecção de processos distintos impede transformar notícia sobre várias decisões em um fato de uma única entidade. Falha de API tem diagnóstico próprio, não aparece como resposta desatualizada.
8. Os critérios já decididos pelo usuário foram mantidos. Nenhuma exceção por ID, município ou fonte foi adicionada.

## Replay das regras no acervo

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Publicações arquivadas | ${old.counts.archive} | ${c.archive} |
| Textos integrais elegíveis | ${old.counts.eligible} | ${c.eligible} |
| Referências comparáveis de mesma fonte | ${old.counts.comparable} | ${c.comparable} |
| Concordância de aceite/descarte | ${old.counts.ruleAgreements} | ${c.ruleAgreements} |
| Falsos aceites da regra | ${old.counts.ruleFalseAccepts} | ${c.ruleFalseAccepts} |
| Falsos descartes da regra | ${old.counts.ruleFalseRejects} | ${c.ruleFalseRejects} |
| Categorias divergentes em aceites | ${old.counts.categoryDisagreements} | ${c.categoryDisagreements} |

Foram ${actualChanged.length} mudanças de categoria simuladas entre os ${c.eligible} textos elegíveis. Registros sem referência não entram na estatística de acerto. Duplicatas e referências apoiadas em outra fonte continuam separados, não rotulados como conteúdo irrelevante. PDFs e textos acima do limite seguem fora deste piloto, sem truncamento.

## Casos ainda retidos

${pending.length?pending.map(x=>`- ${link(x)} — **${labels[x.proposal.reason]||x.proposal.reason}**. Regra: ${x.ruleCategory}; IA: ${safe(x.ai?.answer?.categoria)}. Etapa da regra: ${safe(x.ruleStage)}. Justificativa da IA: ${safe(x.ai?.answer?.justificativa)}`).join('\n'):'Nenhum caso retido nesta amostra. Isso não prova cobertura total do acervo.'}

## Os ${chosen.length} casos: referência, antes e depois

| Publicação | Grupo | Referência | Antes | Proposta | Motivo / prova |
| --- | --- | --- | --- | --- | --- |
${chosen.map(x=>`| ${link(x)} | ${x.cohort==='original40'?'40 originais':x.cohort==='fresh12'?'Sem revisão prévia':'Adicional'} | ${label(x.referenceDecision)} ${safe(x.referenceCategory)} | ${label(x.beforeProposal?.decision)} | ${label(x.proposal.decision)} ${safe(x.proposal.category)} | ${safe(x.proposal.reason)}${x.proposal.evidence?' — '+safe(x.proposal.evidence):''} |`).join('\n')}

## Rastreabilidade e segurança

- [GitHub Actions — execução ${run}](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/${run}); commit ${r.commit}.
- Branch experimental: test/original-triage-simulation. Nenhuma ativação ou alteração em main.
- ${c.aiCalls} chamadas de IA; ${c.aiErrors} erros de API; ${c.usage.input} tokens de entrada e ${c.usage.output} de saída. Sem cache da produção, sem truncamento e sem tentativas repetidas seletivamente.
- Zero chamadas WhatsApp; sem credenciais de envio; arquivos data/ e state/ conferidos por hashes antes/depois e data/, state/, config/, src/ conferidos por git diff no Actions.
- Snapshot ${r.corpusHash}; gerado ${r.generatedAt}. Referência anterior ${r.baselineCommit}.
- As evidências e respostas completas ficam no artefato original-triage-simulation da execução. O JSON deste relatório preserva as métricas e decisões propostas, sem modificar o acervo.
- Referências incluem decisões do usuário e revisões anteriores do assistente; não são uma auditoria humana independente. A concordância é de aceite/descarte e categoria, não verificação de todos os campos da base.
`;
await writeFile('docs/SIMULACAO-ORIGINAIS-V2-2026-10-16.md',header);
await writeFile('docs/simulacao-originais-v2-2026-10-16-resumo.json',JSON.stringify({
  version:r.version,commit:r.commit,run,generatedAt:r.generatedAt,corpusHash:r.corpusHash,
  productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,counts:c,cohorts:r.cohorts,
  sample:chosen.map(x=>({id:x.id,url:x.url,title:x.title,cohort:x.cohort,reference:x.referenceDecision,
    referenceCategory:x.referenceCategory,rule:x.ruleCategory,stage:x.ruleStage,ai:x.ai?.answer,
    before:x.beforeProposal,proposal:x.proposal}))},null,2));
console.log(JSON.stringify({cohorts:r.cohorts,report:'docs/SIMULACAO-ORIGINAIS-V2-2026-10-16.md'},null,2));
