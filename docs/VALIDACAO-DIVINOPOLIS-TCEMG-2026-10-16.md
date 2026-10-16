# Divinópolis e TCE-MG — documentos recuperados e correção retroativa autorizada

## Aplicação de 16/10/2026

Após a validação abaixo, o usuário autorizou aplicar as correções e atualizar o painel. Aplicados quatro fatos canônicos: um de Divinópolis e três atos separados do TCE-MG. A notícia-mãe foi preservada como publicação desdobrada; a segunda URL de Divinópolis foi vinculada como duplicata, sem outro fato. Os cinco PDFs, hashes, páginas e revisões anteriores estão preservados em `data/documentos-primarios/` e `data/catalogo/documentos-primarios-2026-10-16.json`.

Todos os seis registros envolvidos têm `publicar:false`. A aplicação é idempotente; não altera o arquivo original de coletas nem o estado de envio. O painel apresenta prova paginada, link oficial e divergência do CONSANE, distinguindo notícia e acórdão. O experimento de triagem automática de originais permanece **desativado**: a correção documental autorizada não é uma aprovação de sua ativação.

## Resultado para validação do usuário

No momento da proposta, foram recuperados cinco PDFs primários: lei e publicação oficial de Divinópolis, mais três acórdãos do TCE-MG. A revisão documental permitiu propor quatro fatos distintos, inicialmente sem aplicação. O resultado anterior da simulação de originais continua 80/82; estas provas complementares não estavam naquele teste e não transformam seu resultado em 82/82 automático. A autorização posterior e sua aplicação estão registradas acima.

| Caso | Antes | Proposta sustentada pelos documentos |
| --- | --- | --- |
| Divinópolis / Mulheres das Gerais | Notícia de aprovação; divergência entre saída municipal e extinção; sanção não comprovada. | Aceitar como **GOVERNANÇA — autorização legislativa para subscrever extinção**, Lei 9.770/2026, publicada em 24/09. Revoga Lei 9.013/2022. Não afirmar saída consumada ou extinção efetiva. |
| CIMINAS / 1214381 | Manutenção de cautelar pela notícia. | Aceitar **CONTROLE — referendo de suspensão cautelar** da ARP 041/2026, Concorrência 002/2026. Proíbe contratações e adesões à ata. Não é condenação final nem prova de multa aplicada. |
| CIMINAS / 1210770 | Notícia diz apenas que o voto foi acompanhado; revisão antiga agrupou o caso como manutenção de cautelar. | Corrigir para **CONTROLE — extinção processual sem resolução de mérito por perda de objeto, com multa de R$ 10 mil ao presidente**, Frederico Ozanan Rangel, por descumprimento da determinação de informar a revogação. A multa não é atribuída ao consórcio como pessoa jurídica. |
| CONSANE / 1217968 | Notícia usa 1217068 e o nome por extenso de outro consórcio. | O acórdão comprova **CONTROLE — referendo de suspensão cautelar** da ARP 4/2026, Pregão 4/2026, do **Consórcio Regional de Saneamento Básico**. Preservar divergência da notícia; não converter números por aproximação. |

Todos os acórdãos examinados são da sessão de 29/09/2026. Isso não comprova trânsito em julgado nem ausência de decisões posteriores.

## Evidências primárias e páginas

### Divinópolis

- [Ficha da Lei 9.770/2026 no SAPL](https://sapl.divinopolis.mg.leg.br/norma/22340?display): vincula PL EM 51/2026 à lei sancionada em 21/09/2026, publicação em 24/09/2026.
- [PDF da lei, página 1](https://sapl.divinopolis.mg.leg.br/media/sapl/public/normajuridica/2026/22340/lei_no_9770-2026_-_extincao_do_consorcio_mullheres_das_gerais.pdf): art. 1 autoriza subscrever a extinção; art. 2 revoga Lei 9.013/2022.
- [Publicação oficial, página 1](https://sapl.divinopolis.mg.leg.br/media/sapl/public/anexonormajuridica/2026/3921/extrato_-_lei_no_9.770_de_21_de_setembro_de_2026__diario_oficial_dos_municipios_mineiros.pdf): Diário Oficial dos Municípios Mineiros, edição 4367, código 7F3C92D0.
- O [projeto original](https://sapl.divinopolis.mg.leg.br/media/sapl/public/materialegislativa/2026/45445/projeto_de_lei_em_no_051-2026_-_extincao_consorcio_mulheres_das_gerais-copia-impressao.pdf) usa subscrição de extinção no dispositivo e revogação de adesão na justificativa. Não foi só erro da raspagem. A lei fornece uma redação normativa verificável, mas não comprova a execução da autorização.

### TCE-MG: dois caminhos de acesso e uma limitação

A pesquisa TCJuris apresentou CAPTCHA. Não se contornou o desafio. Os documentos foram encontrados nos **Diários Oficiais de Contas**, pelas edições posteriores à sessão, seguindo os links `Inteiro Teor` embutidos nos PDFs. O Node recusou inicialmente a cadeia de certificado de `tcnotas`; o curl do Windows conseguiu acesso com validação TLS normal, sem `--insecure`.

1. [DOC de 08/10, páginas 10–11](https://doc.tce.mg.gov.br/Home/ViewDiario/2026_10_08_Diario.pdf) → [acórdão 1214381, arquivo 4759754](https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4759754): identificação na p. 1, dispositivo na p. 2. Multa de R$ 5 mil é advertência condicionada a eventual descumprimento, não penalidade já aplicada.
2. [DOC de 14/10, páginas 17–18](https://doc.tce.mg.gov.br/Home/ViewDiario/2026_10_14_Diario.pdf) → [acórdão 1210770, arquivo 4760666](https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4760666): dispositivo na p. 2; motivo da multa nas pp. 5–6. Houve cumprimento da suspensão, mas falta de comunicação da revogação. Apenso 1211638 não é um quarto episódio independente. A ata da sessão no DOC de 02/10, pp. 16–17, também registra extinção e multa.
3. [DOC de 08/10, páginas 9–10](https://doc.tce.mg.gov.br/Home/ViewDiario/2026_10_08_Diario.pdf) → [acórdão 1217968, arquivo 4759190](https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4759190): identidade e número na p. 1; dispositivo na p. 2. Refere-se a uniformes escolares. A multa diária de R$ 1 mil, limitada a R$ 18 mil, é condicional; não registrar como já cobrada.

**Ressalva de associação:** a [notícia](https://tce.mg.gov.br/noticia/Detalhe/1111629212) traz `1217068` e “Consórcio Público para o Desenvolvimento do Alto Paraopeba (Consane)”. O documento recuperado é `1217968`, Consórcio Regional de Saneamento Básico. Mesma sessão, relator, sigla e referendo sustentam a proposta de correção editorial da notícia. Não há correspondência exata dos identificadores nem errata do TCE localizada. O fato do acórdão está comprovado independentemente desse vínculo. Não afirmar que se recuperou o processo `1217068`.

## Deduplicação e correção retroativa propostas

- Divinópolis já aparece sob `530064fc…` e `da010f90…`, URLs diferentes, mas **mesmo SHA-256 do corpo** `cacf8254552d8725556cbf201ea3979dba0058b6664610d54ec24390372a670d`. A primeira tem revisão editorial de aprovação do PL. Vincular ambas ao mesmo episódio; manter aprovação e sanção como etapas datadas, não gerar duas notícias idênticas. Lei/publicação são novas evidências, não autorização de reenvio.
- TCE já consta no registro `4ad8ed86…`, confirmado com síntese que generaliza manutenção de cautelares aos três processos. Essa revisão precisa ser corrigida na futura aplicação; a referência humana anterior não é infalível.
- Separar os três atos com chaves por tribunal + processo + sessão + tipo de decisão; preservar a notícia como fonte compartilhada, sem contá-la como um quarto fato. Não juntar 1210770 e 1214381 só porque ambos envolvem CIMINAS. Não criar identidade CODAP baseada no erro por extenso.
- Qualquer futura aplicação deve ser idempotente, puramente retroativa e `publicar=false`, sem alimentar fila de WhatsApp ou resumo semanal. Implementação/aplicação ainda depende do próximo aceite do usuário.

## Validações executadas e limites

- Download íntegro de cinco PDFs, total 37 páginas; extração por página e SHA-256 preservados em `output/document-recovery-2026-10-16/validated-evidence.json` (artefato local ignorado pelo Git).
- **17 verificações de trechos em páginas determinadas**, cabeçalhos de processo, contagem de páginas, rejeição explícita de equivalência `1217068 == 1217968` e chaves distintas. Verificador: `scripts/validate-two-cases.py`; não é classificador automático.
- Conferência visual da publicação da lei e da página 2 dos três acórdãos. As páginas sustentam identidade, estágio e dispositivo. Não foi validada criptograficamente a assinatura digital nem consultado o andamento processual posterior.
- **451 testes existentes passaram localmente**. Não houve execução nova no Actions, nova chamada DeepSeek, alteração de regras de produção ou replay substituindo os 82 resultados.
- Verificador comparou hashes de **93 arquivos protegidos** antes/depois (dados, estado, configuração, código, painel e workflows); nenhum mudou. Comparação Git contra HEAD também deve permanecer limpa nesses diretórios.
- Percurso reutilizável: SAPL matéria → norma gerada → PDF/publicação; TCE notícia → diário → link do inteiro teor → página do dispositivo. Não usar só títulos ou ementas para determinar estágio, pessoa multada ou número corrigido.

### Hashes dos documentos

| Arquivo | SHA-256 |
| --- | --- |
| divinopolis-lei-9770.pdf | b4e8dd1ce090d93cd6d2d6446ed931e9f7b1380429cc45ff14f7798029ff1a9c |
| divinopolis-publicacao.pdf | df98573c22e07448befe9001bd43403274614d772dbb5df7dd558387384b2851 |
| tce-1214381.pdf | 8970b58f9a446483e68f5f3a5ebc1ba9831d52d012f12ea50ca8e4f830888b0f |
| tce-1210770.pdf | 64ef19292371142d5d118e14fa81aae5eb65976bf2212b68c1063bf517b0ef18 |
| tce-1217968.pdf | eeeaf1134bc396e98d0c77b39fd0c98c75977bcf9ad51d7664df4609658adf72 |
