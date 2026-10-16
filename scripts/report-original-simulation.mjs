// Presentation only: consume one frozen report; never rerun inference or edit data.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const file=process.argv[2];
if(!file) throw new Error('Provide the saved simulation report path.');
const r=JSON.parse(await readFile(file,'utf8'));
if(r.productionActivated!==false || r.protectedFilesUnchanged!==true || r.whatsappCalls!==0)
  throw new Error('Report lacks simulation safety attestations.');
const chosen=r.results.filter(x=>x.selectedForAi), c=r.counts;
const relevant=chosen.filter(x=>x.ruleRelevant).length;
const naiveErrors=chosen.filter(x=>x.ruleMatchesReference===false).length;
const naiveCategories=chosen.filter(x=>x.expectedRelevant && x.ruleRelevant && x.referenceCategoryMatches===false).length;
const pending=chosen.filter(x=>x.proposal.decision==='pendente');
const reasonLabels={divergencia_regra_ia:'Regra e IA discordaram',etapa_ou_prova_da_regra_insuficiente:'Etapa ou prova da regra insuficiente',
  identidade_sem_prova_literal:'Validação literal do nome falhou',multiplos_atos:'IA apontou vários atos'};
const reasons=pending.reduce((a,x)=>(a[x.proposal.reason]=(a[x.proposal.reason]||0)+1,a),{});
const safe=s=>String(s||'').replace(/\|/g,'/').replace(/[\r\n]+/g,' ');
const link=x=>`[${safe(x.title)}](${x.url.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
const status=x=>x==='aceito'?'Aceitar':x==='descartado'?'Descartar':'Pendente';
const primary=r.results.filter(x=>x.eligible&&x.expectedRelevant!==null&&x.sameEvidenceReference);
const differences=primary.filter(x=>x.ruleMatchesReference===false||x.referenceCategoryMatches===false);
const markdown=`# Simulação de confirmação automática de originais — 16/10/2026

**Conclusão: não ativar ainda.** Na amostra de 40 textos, a proposta resolveu ${c.aiDecisions.aceito+c.aiDecisions.descartado} (${((c.aiDecisions.aceito+c.aiDecisions.descartado)/40*100).toFixed(1).replace('.',',')}%) e reteve ${c.aiDecisions.pendente}. Nenhuma das decisões efetivamente propostas divergiu do aceite/descarte ou categoria editorial, nesta amostra. Isso não é 100% de acerto no acervo nem garantia sobre notícias futuras.

## Segurança e reprodução

- Execução [38957521537](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38957521537), commit ${r.commit}, concluída com sucesso. Experimento apenas na branch **test/original-triage-simulation**; main, painel e fluxo de produção não foram modificados.
- **Zero chamadas de WhatsApp; zero alterações em data/, state/, config/ ou src/.** O executor compara hashes antes/depois; não há modo de aplicação, importação de emissor nem credenciais de WhatsApp.
- ${c.aiCalls} chamadas DeepSeek, sem erro de API, corpo completo e sem truncamento; ${c.usage.input.toLocaleString('pt-BR')} tokens de entrada e ${c.usage.output.toLocaleString('pt-BR')} de saída. Respostas não alimentaram o cache de IA da produção.
- 423 testes locais passaram, incluindo sete novos de isolamento, integridade, evidência literal, etapa, identidade e ausência de alteração da produção. Os sete testes novos também passaram no Actions.
- Corpus congelado: ${r.corpusHash}. Dados de ${r.generatedAt}. Novas coletas posteriores não estão incluídas.

## Antes e depois — os mesmos 40 casos

“Antes” abaixo é a hipótese de **promover diretamente o resultado das regras**, não o estado da base publicada. “Depois” é a política experimental: regra + IA, trecho literal, etapa definida e identidade comprovada (ou orientação geral explícita).

| Resultado | Só regras, sem as novas travas | Proposta com travas + IA |
| --- | ---: | ---: |
| Aceitar conteúdo | ${relevant} | ${c.aiDecisions.aceito} |
| Descartar conteúdo | ${40-relevant} | ${c.aiDecisions.descartado} |
| Reter para resolver | 0 | ${c.aiDecisions.pendente} |
| Divergências de aceite/descarte frente à referência | ${naiveErrors} | ${c.aiDecisionDisagreements}, entre ${c.aiDecisionAgreements+c.aiDecisionDisagreements} decididos |
| Categoria divergente nos aceites | ${naiveCategories} | ${c.aiAcceptedCategoryDisagreements} |

Os oito aceites não são oito novos fatos: são decisões simuladas de registros que já revisamos. Nenhum foi aplicado nem reenviado. A camada de deduplicação ainda precisa ser validada antes de promover qualquer registro novo.

## O que foi comparado no acervo

| Universo | Quantidade |
| --- | ---: |
| Publicações arquivadas | ${c.archive} |
| Textos integrais armazenados | ${c.storedFulltext} |
| Leituras elegíveis para este piloto de originais | ${c.eligible} |
| Elegíveis com alguma revisão editorial | ${c.eligibleReviewed} |
| Comparação principal: aceite/descarte com a mesma fonte | ${c.comparable} |
| Concordância das regras nessa comparação principal | ${c.ruleAgreements}/${c.comparable} |
| Falsos aceites pelas regras | ${c.ruleFalseAccepts} |
| Falsos descartes pelas regras | ${c.ruleFalseRejects} |
| Categorias divergentes entre conteúdos aceitos | ${c.categoryDisagreements} |
| Segunda leitura de IA, amostra estratificada fixa | ${c.aiSelected} |

Os ${c.reviewedDuplicates} registros marcados como duplicata são analisados à parte, pois duplicata não é sinônimo de conteúdo irrelevante. Há ${c.externalReferenceCases} elegíveis cuja revisão usa outra URL como evidência; alguns também são duplicatas, portanto esses números não devem ser somados. Sete atos separados manualmente não foram usados como se fossem originais extraídos automaticamente.

As ${c.ineligibleReasons.sem_integra_armazenada} publicações sem íntegra armazenada **não representam ${c.ineligibleReasons.sem_integra_armazenada} falhas novas**: muitas são notícias fora do tema que não precisaram de leitura completa no fluxo vigente. Este piloto exige íntegra e não reclassifica esses registros por ausência de texto. Também ficaram fora 13 PDFs, cinco textos acima de 24 mil caracteres e uma reprodução identificada. Não foi usado truncamento para fazê-los caber.

## Por que 19 ainda não receberam decisão

| Motivo | Casos | Próxima correção |
| --- | ---: | --- |
${Object.entries(reasons).map(([key,n])=>`| ${reasonLabels[key]||key} | ${n} | ${key==='identidade_sem_prova_literal'?'Comparar caixa/acentos e separar nome da sigla, mantendo prova no corpo; não inferir CNPJ.':key==='multiplos_atos'?'Distinguir vários efeitos de uma mesma norma de atos realmente independentes.':key==='divergencia_regra_ia'?'Exigir prova municipal de composição; requerimento aprovado não equivale a autorização legal; separar categoria de etapa.':'Definir a etapa do fato e selecionar o trecho principal; não aproveitar boilerplate de assembleia.'} |`).join('\n')}

### Exemplos reais

- **Reunião ABC–Braskem:** aceito como atuação realizada; não afirma acordo ou entrega.
- **Composição do consórcio de acolhimento/Amurc:** aceito como governança; não cria ano de ingresso.
- **CNM / orientação tributária:** aceito como FINANÇAS de abrangência geral, sem entidade fictícia.
- **Convocação da 121ª assembleia CIMCERO:** descartada, conservando o documento no acervo.
- **Ficha do Acórdão 2330/2025, TCE-PR:** a regra propôs FINANÇAS; a IA identificou insuficiência do conteúdo. A trava reteve o caso, em vez de aceitar uma ficha como julgamento comprovado.
- **ABC + Seguro:** regra e IA concordaram em GOVERNANÇA, mas nossa referência é ATUAÇÃO. A trava de etapa/prova barrou a promoção. Concordância entre regra e IA, sozinha, não assegura acerto.
- **São Lourenço da Mata:** a IA interpretou aprovação de requerimento como autorização de ingresso; a regra discordou e bloqueou. Mantém-se o critério já decidido pelo usuário.
- **CEMMIL / seleção de pessoal e CISVARC / próteses:** a IA chamou identificação do nome da entidade de “composição”. Não apresentou municípios consorciados como prova. A regra barrou ambos; não há decisão editorial nova a pedir ao usuário.
- **Quatro nomes:** falharam porque a IA acrescentou sigla entre parênteses ao nome, ou mudou caixa/acentos, sem repetir essa forma exata na citação. São limitações do validador deste protótipo, não quatro entidades comprovadamente desconhecidas.

## Divergências das regras no conjunto principal de 58

| Publicação | Nossa referência | Regra | Tipo de problema |
| --- | --- | --- | --- |
${differences.map(x=>`| ${link(x)} | ${safe(x.referenceCategory || x.referenceDecision)} | ${x.ruleCategory} | ${x.ruleMatchesReference===false?'Aceitaria conteúdo insuficiente/listagem':'Categoria do fato'} |`).join('\n')}

## Amostra completa de 40: decisão anterior e proposta

| Publicação | Referência editorial | Regra | IA | Proposta |
| --- | --- | --- | --- | --- |
${chosen.map(x=>`| ${link(x)} | ${status(x.referenceDecision)}${x.referenceCategory&&x.referenceCategory!=='GERAL'?' · '+x.referenceCategory:''} | ${x.ruleCategory} | ${safe(x.ai?.answer?.categoria || 'erro')} | ${status(x.proposal.decision)}${x.proposal.decision==='pendente'?' · '+(reasonLabels[x.proposal.reason]||x.proposal.reason):''} |`).join('\n')}

## Limites e próxima rodada

${r.caveats.map(x=>'- '+x).join('\n')}
- A amostra foi escolhida com semente fixa e estratificação pela regra, sem passar a resposta editorial ao modelo. Na amostra há 23 aceites e 17 descartes de referência. Não é uma amostra representativa do fluxo diário.
- A seleção de etapa ainda é incompleta, e uma etapa genérica como “celebração a conferir” não deve autorizar promoção. Acrescentar essa trava explícita antes de ativar.
- A identificação automática por equivalência exata encontrou candidato em apenas ${c.duplicatesWithExactCandidate} dos ${c.reviewedDuplicates} casos editoriais de duplicata; isso não mede o desempenho de toda a deduplicação em produção. Falta testar agrupamento de episódio e escolha da fonte canônica separadamente.
- Corrigir primeiro validação do nome e detecção de listagens; depois etapa/categoria e múltiplos atos. Repetir a simulação e acrescentar amostra nova, ainda não usada para ajustar regras. **Não ativar agora.**
`;
const destination=path.join('docs','SIMULACAO-ORIGINAIS-2026-10-16.md');
await writeFile(destination,markdown);
await writeFile(path.join('docs','simulacao-originais-2026-10-16-resumo.json'),JSON.stringify({
  version:r.version,commit:r.commit,generatedAt:r.generatedAt,corpusHash:r.corpusHash,counts:c,
  productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,
  sample:chosen.map(x=>({id:x.id,url:x.url,title:x.title,reference:x.referenceDecision,referenceCategory:x.referenceCategory,
    rule:x.ruleCategory,aiCategory:x.ai?.answer?.categoria,proposal:x.proposal})),
},null,2));
console.log(destination);
