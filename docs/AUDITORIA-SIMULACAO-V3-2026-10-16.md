# Auditoria da terceira rodada — critérios, erros e evidências complementares

## Fechamento

[Resultado final v3.2](SIMULACAO-ORIGINAIS-V32-2026-10-16.md): **80/82 decisões**, incluindo os 40 originais sem pendências. Nos mesmos 70, nove → dois retidos; nos 12 adicionais, um aceite e 11 descartes. Nenhuma ativação.

O complemento v3.1 [38963339185](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38963339185) passou 450 testes e fez 79 chamadas. Resolveu os casos de histórico, oficina, ordem judicial, alteração de protocolo e parceria firmada, mas a IA voltou a aceitar concurso CEMMIL como atuação; a regra bloqueou. Uma resposta do mural veio com JSON inválido; o descarte é sustentado pela regra explícita, não pela IA.

O fechamento v3.2 [38963842366](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38963842366) passou 451 testes e repetiu **todas as respostas salvas**, sem nova chamada de IA, sem substituir respostas ruins. Separou-se versão da regra (3.2) e política de leitura (3.1). O único delta decisório sobre v3.1 foi CEMMIL: retido → descarte explícito de seleção de pessoal. Histórico e composição municipal comprovados continuam protegidos dessa exclusão. Permanecem apenas Divinópolis e a notícia com três processos TCE-MG.

Não houve divergência de aceite/descarte ou categoria entre as 57 decisões concluídas que têm referência comparável. A auditoria dos casos novos é do assistente e a amostra foi usada para ajuste; não apresentar a taxa de decisão como precisão futura.

## Escopo e segurança

Somente simulação na branch `test/original-triage-simulation`. Não alterar `src`, configuração, acervo, revisões, painel ou estado do WhatsApp. Não aplicar automaticamente decisões nem transformar republicações em fatos novos.

A primeira execução v3 é [38962668846](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38962668846), commit `bb4dd52`: 444 testes, 82 documentos, 79 chamadas de IA, zero erros de API. [Relatório congelado](SIMULACAO-ORIGINAIS-V3-2026-10-16.md). Não substituir os seus resultados pelos de uma tentativa posterior.

## O que a primeira repetição mostrou

- Nos 40 originais, continuaram 38 decisões, mas não os mesmos casos: a cautelar sobre contrato municipal passou a descarte correto; a instrução normativa do CIDESAA ficou retida por nova divergência de categoria. O caso da lei CIDESAA acertou a categoria, mas a citação de identidade trocou travessão/hífen e foi bloqueada.
- Nas quatro republicações com corpo idêntico do CISVP, uma chamada produziu quatro vínculos consistentes e a mesma prova: entrega da Recomendação 23/2026. Isso não equivale a quatro novos acontecimentos. O episódio já tem registro confirmado `97888cdb…` e outras republicações revisadas.
- O histórico CONSUD foi reconhecido como constituição relatada em 2023 por fonte secundária, sem afirmar leitura do ato original. A oficina sediada pelo ABC foi reconhecida como atividade realizada.
- No CISMIV, a IA citou a obrigação municipal de 90 dias como prova de uma obrigação do consórcio. A nova proteção recusou. O texto distingue prefeitura (90 dias) e consórcio (180 dias); não permitir que um prazo seja transferido ao outro.
- A parceria ABC–Metodista continua sendo contexto de acordo já firmado; o anúncio de entrega de documentos em novembro não comprova bolsas entregues. O acordo já foi confirmado na base sob `ca8c07d2…`; não seria um fato novo.

## Os 12 textos adicionais

Escolhidos e congelados antes de ler as respostas, por ID e hash; seis positivos e seis negativos pela regra de produção, sem repetir corpos dos 70 anteriores. Depois de usados nos ajustes v3.1, **não são mais um holdout intocado**. Diferentes corpos tampouco garantem diferentes episódios. Cinco dos 12 são fichas do TCE-PR, o que limita a diversidade da amostra.

| ID | Conteúdo | Conferência do assistente / critério |
| --- | --- | --- |
| 34f2e231 | TCE-PR, acórdão 3353/2021 | Ficha sem dispositivo; não registrar julgamento, seguir link do PDF em outro fluxo. |
| 75410f2d | TCE-PR, acórdão 24/2019 | Mesmo limite: classificação processual não prova resultado. |
| a53fd21d | TCE-PR, acórdão 1988/2020 | Ficha sem ementa ou dispositivo. |
| c25aac40 | TCE-PR, acórdão 3548/2016 | Ficha sem resultado; o ano da consulta não muda o ano do acórdão. |
| 7831e8d3 | TCE-PR, acórdão 325/2019 | Ficha sem resultado; não presumir irregularidade. |
| 7a5aefb2 | TCE-PB, contas do Vale do Piancó | Controle: contas de 2023 reprovadas, multa individual ao gestor; recurso ainda possível. Não atribuir multa à entidade. |
| d9406dcf | Concurso acolhimento AMURC | Seleção de pessoal sem municípios consorciados nomeados nem histórico de constituição. Diferente da outra matéria que comprovava composição. |
| 7c06e6f7 | Seminário ECA Digital no ABC | Anúncio no futuro, não prova realização. IA tentou aceitar na primeira repetição; regra impediu. |
| 4f0adc7b | Crédito suplementar de Campo Novo do Parecis | Rubrica genérica de rateio, não instrumento celebrado. |
| f5e8191e | AGERR/Pantanal, recomposição tarifária | Perguntado ao usuário antes de generalizar. **Decisão: descartar como rotina operacional.** Não expandir a exclusão para normas gerais de inspeção ou alterações institucionais. |
| dabc05ee | Uniformes escolares, Figueirópolis | Contrato municipal com fornecedor; ata do consórcio não significa adesão institucional. |
| eed5a239 | Credenciamentos CISVARC, hospital e laboratório | Contratação rotineira excluída por decisão anterior do usuário; estimativa de atendimentos não é execução. Regra tentou ATUAÇÃO, IA recusou; ficou bloqueado. |

Essas notas são conferência pelo assistente sobre o texto armazenado, não uma nova rodada de aprovação humana dos 12. A única decisão editorial nova solicitada ao usuário nesta rodada foi a exclusão da rotina tarifária.

## Pesquisa separada: por que não preencher os casos complexos por suposição

### Divinópolis — saída ou extinção?

A [notícia da Câmara sobre a 55ª reunião](https://www.divinopolis.mg.leg.br/institucional/noticias/cinco-projetos-foram-aprovados-durante-a-55a-reuniao-ordinaria) identifica o consórcio Mulheres das Gerais e o projeto EM 051/2026. Contudo, a fala reproduzida descreve revogação de adesão, enquanto a ementa trata de autorização para subscrever a extinção. O [resumo da sessão no SAPL](https://sapl.divinopolis.mg.leg.br/sessao/1471/resumo) também lista aprovação do projeto com essa ementa. A busca recuperou o resumo; a abertura direta pelo navegador de pesquisa falhou nesta tentativa.

O original secundário `da010f90…` não contém o nome do consórcio. Não inserir o nome encontrado externamente no input da simulação de original nem contabilizar o caso como resolvido pelo classificador. Próxima etapa documental: texto do EM 051/2026, tramitação e norma gerada; preservar aprovação de projeto, autorização vigente e eventual dissolução/saída como etapas distintas.

### TCE-MG — três processos

A [notícia oficial](https://tce.mg.gov.br/noticia/Detalhe/1111629212) confirma que se trata de processos diferentes. O protótipo separa os trechos com offsets, sem copiar o dispositivo de um para outro. O trecho do processo 1210770 apenas relata acompanhamento do voto, sem detalhar seu resultado. O processo 1217068 associa um nome e uma sigla cuja correspondência exige conferir a decisão original. Não corrigir a entidade por aproximação.

A pesquisa também encontrou um [acórdão do processo 1211638](https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4623365) que referencia 1210770. Não foi usado como se fosse a decisão noticiada de setembro: são número e momento diferentes. Os documentos adicionais não entram retroativamente na métrica do original.

## Alterações motivadas pela auditoria

- Identidade: se a IA altera a pontuação da citação, procurar o nome completo no próprio corpo e devolver o trecho real encontrado. Não inventar sigla, não consultar cadastro externo e não relaxar a prova literal do fato.
- Evento futuro: apoio, local e data já transcorrida não comprovam realização.
- Credenciamento: previsão de capacidade/valor não é atendimento executado.
- Parceria: distinguir assinatura passada de inscrições e benefícios futuros; manter revisão de duplicidade do episódio.
- Normas de inspeção: instruir a IA a ler o dispositivo que estabelece procedimentos, não o preâmbulo que cita outra resolução.
- Ordem judicial: exigir prova da obrigação do consórcio, sem usar prazo exclusivo da prefeitura.
- Rotina tarifária: exclusão explícita, conforme resposta do usuário nesta rodada.

Uma primeira execução de teste local deste complemento detectou erro de fronteira de palavra após o verbo acentuado “ocorrerá”. Corrigido e coberto por teste antes de publicar/rodar o complemento no Actions.
