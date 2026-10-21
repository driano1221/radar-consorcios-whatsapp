# Painel de acompanhamento do Radar

Interface estática, **somente de leitura**, para acompanhar documentos, decisões e a base histórica. O visual é de registro editorial: lista compacta à esquerda, justificativa e trecho disponível à direita. No celular, a ficha fica abaixo da lista. O motivo aparece na ficha e como dica ao passar o mouse; não depende apenas do hover. Não há login, editor, envio ao WhatsApp nem chamada a APIs externas no navegador.

## Abrir localmente

Na raiz do repositório:

```sh
npm run dashboard:build
npm run dashboard:serve
```

Abra `http://127.0.0.1:4173/`. O servidor aceita conexões **somente deste computador**. Para atualizar a fotografia, sincronize o repositório e execute `dashboard:build` novamente. `dashboard/dist/` é gerado e ignorado pelo Git.

## O que aparece

- **Triagem:** registros confirmados, rejeitados ou em Revisar comigo, com sete famílias de categoria. Os quatro totais usam a mesma unidade: registros analisados = confirmados + rejeitados + revisão. Um documento pode fornecer vários fatos, cada um com prova e decisão próprias. A fonte agregada fica rejeitada como registro adicional, para evitar duplicação; não existe um quarto status de desdobramento. A lista mostra até 80 registros por seleção.
- **Revisar comigo:** reúne somente casos inconclusivos. Cada ficha tem fonte, dúvida e verificações específicas. As decisões já confirmadas ou rejeitadas não entram nesse contador por terem metadados incompletos.
- **Resultados:** três indicadores distinguem consórcios identificados, fatos confirmados e municípios com participação documentada. O número de consórcios com CNPJ associado aparece separadamente; o CNPJ está registrado na base, mas sua identidade ainda requer conferência documental e não está homologada pelo Ipea. O período (todo o acervo, últimos 30 ou 7 dias) acompanha a última coleta. A linha do tempo alterna entre primeira descoberta pelo radar e data do fato comprovada; se esta faltar, usa apenas a data da publicação original recuperada. Fatos sem data suficiente não são posicionados arbitrariamente. Assunto, UF, fonte e consórcios citados vêm das linhas confirmadas de `eventos.csv`.
- **UF dos fatos:** o painel prioriza a UF já gravada, a revisão editorial, a localização explícita no título, o domínio oficial e o trecho recuperado, nesta ordem. Quatro casos históricos sem indicação direta foram conferidos em fontes institucionais e estão em `data/catalogo/ufs-revisadas.json`, com justificativa e URL. Publicação interestadual pode contar em mais de uma UF. A tabela de eventos do painel mostra o critério, a evidência e o link; se um novo registro continuar sem localização segura, permanece “Não identificado” até revisão — nunca recebe a UF da sede do veículo por suposição.
- **Publicações:** arquivo pesquisável com filtros. A ficha mostra primeiro o resultado, o motivo, a prova disponível e o destino no WhatsApp. Datas, vínculos, demais trechos de PDF e detalhes técnicos ficam em “Ver todas as datas, vínculos e detalhes da análise”. Texto recuperado e sugestões não viram automaticamente fatos confirmados.
- **Base completa:** todas as linhas e colunas de `eventos.csv`, `atos.csv`, `consorcios.csv`, `participacoes.csv`, `vinculos-documentos.csv`, `identidade-pendente.csv`, `arquivo-coletas.ndjson` e `revisoes-eventos.ndjson`. A lista resume os campos principais sem rolagem horizontal; a ficha exibe **todas as colunas**, inclusive vazias como “Não informado”. Há busca e glossário. A aba de atos mostra documento pai e página de cada decisão.
- **Como funciona:** um fluxograma vetorial gerado por `scripts/build-flow-diagram.mjs` mostra a coleta, a leitura e os triagem com prova (confirmada, rejeitada ou Revisar comigo), seguida, somente para confirmadas, dos controles de alerta (data, novidade, fila e cota). Há arranjos separados para desktop e celular, link para abrir o SVG em tamanho real e uma transcrição textual acessível. O cadastro de fontes é gerado da configuração atual e distingue ativas, em prévia e desativadas. Falhas da última coleta ficam recolhidas ao final.

O painel lê as tabelas de `data/catalogo/` e o estado versionado. A categoria e a etapa **revisadas editorialmente** prevalecem sobre o registro bruto. Atos antigos reindexados recentemente permanecem no arquivo histórico, mas não aparecem como eventos atuais. A tela nunca equipara documento, menção ou autorização legal a ingresso/saída efetiva.

**Meta de qualidade ainda não concluída:** reduzir candidatos e pendências até que quase todo documento seja aceito ou descartado com justificativa e evidência. Candidato deve ser exceção temporária para insuficiência real de prova ou conflito relevante. A interface não pode “zerar” pendências apenas trocando o rótulo: recuperar texto, conferir identidade, resolver divergências e reprocessar o acervo com testes de regressão. A fotografia atual ainda contém casos a conferir.

## Direção visual

O estudo local `dashboard/prototypes/compare.html` compara três abordagens com a mesma fotografia de dados: Registro, Mesa e Caderno. A versão implementada segue **Registro**, com lista densa, títulos editoriais, separadores finos e evidência em destaque. A versão anterior inspirada no Windows XP foi descontinuada. O fluxo usa a contenção visual sugerida por [Diagram Design](https://github.com/cathrynlavery/diagram-design); a revisão eliminou a janela falsa e a dependência de hover observadas no guia [Hallmark](https://github.com/Nutlope/hallmark). [CursorFX](https://github.com/devkancheti4-design/cursorfx) foi examinado, mas efeitos de cursor e som não foram incorporados ao painel de leitura. [Dembrandt](https://github.com/dembrandt/dembrandt) também foi examinado, sem extrair nem reproduzir a identidade visual de sites terceiros.

## Recuperação de texto

O radar tenta ler até 12 páginas originais por coleta quando o feed trouxe só o título **ou um resumo curto**. Compara Mozilla Readability e Trafilatura; discordância de categoria ou falha de um dos leitores deixa o item em **prévia**. Para links do Google Notícias, resolve primeiro o endereço do veículo; preserva a URL do feed como chave de deduplicação. Conteúdo bloqueado, PDF ou página sem texto relevante não é tratado como recuperado. Se o texto mudar a categoria, o item também fica em prévia e não é enviado automaticamente.

O retroativo pode ser conferido com `node scripts/backfill-article-text.mjs --limit=20` e salvo com `node scripts/backfill-article-text.mjs --limit=20 --apply`. A rotina diária também percorre até 20 títulos antigos do Google Notícias (incluindo uma quarta tentativa controlada), até 10 PDFs e recalcula as sugestões. O texto integral recuperado é preservado em `data/catalogo/textos-artigos.ndjson`, com hash, leitor, URL direta e omissão de CPF/e-mail; `trecho` continua curto para consulta. PDFs com texto geram trechos atribuídos à página em `recuperacao-pdf-google.ndjson`. Nenhuma dessas rotinas envia mensagens ou transforma sugestão em evento confirmado. Fontes indisponíveis continuam marcadas com motivo específico.

## Rastreio de decisões

### Fonte original e fontes alternativas

Para **novos registros desde 16/10/2026, 14h13min25s (Brasília)**, a leitura alternativa pode sustentar a decisão automática quando regras e DeepSeek concordam sobre o mesmo episódio, com citações literais verificadas. A ficha mostra “regras e IA com fonte alternativa”, motivo, prova e link próprio. Isso não é revisão humana. A fonte original permanece separada; a versão pública exibe trechos, não republica a íntegra.

Históricos, enviados e revisados manualmente não são reclassificados por essa integração. Duplicatas ficam relacionadas ao registro anterior, sem segundo fato ou envio. Conflitos/erros são exceções explícitas. Aceitar na base não libera WhatsApp pela recuperação.

As leituras de `fontes-alternativas.ndjson` aparecem separadas na ficha, com a marca **OUTRA FONTE — NÃO É O ORIGINAL**. Cada uma mostra veículo, título próprio, link direto, trecho, data da recuperação, motivo da associação e independência conhecida. Leitura reaproveitada do acervo informa sua data original; registrar o vínculo não significa reabrir o site.

A decisão e seu trecho de prova continuam acima, sem substituição automática. “Fonte citada na revisão” exige uma revisão editorial válida que aponte para aquela URL; nos demais casos aparece “Não citada na decisão atual”. Sem uma revisão, semelhança de título nunca equivale a confirmação do episódio. PDFs recuperados do próprio portal são identificados como documento original, não como uma segunda reportagem; o texto local mantém marcadores de página.

Na triagem, abra **Fontes alternativas · texto e origem**; em **Publicações**, a seção já fica visível. Para o exemplo real, busque **SEMANA 7** e escolha a notícia dos **100 pacientes**. As duas leituras auxiliares vieram da [validação no Actions](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38929375969); os hashes e datas originais foram preservados. A publicação continua duplicata: não é um novo achado nem novo envio.

O site público exibe até 500 caracteres de cada leitura e link da íntegra no veículo; a consulta local permite expandir o texto guardado. O build público remove os corpos integrais e omite identificadores pessoais. A montagem da ficha valida os hashes, descarta links inseguros e não modifica o catálogo nem os contadores.

O radar passa a guardar em `state/news-state.json` um registro compacto das decisões recentes, limitado a 1.500 URLs e 14 dias: motivo, categoria, pontuação, prévia/fila/seleção, data da última coleta e número da execução. Não duplica texto integral nem segredos. Antes da primeira execução persistente com essa mudança, fichas antigas usam o motivo editorial do catálogo ou uma **reclassificação identificada como reconstruída**, que pode diferir da decisão tomada naquela rodada. O log mostra a **última decisão por URL**, não uma auditoria imutável de todas as rodadas nem a deduplicação exata entre URLs diferentes.

## GitHub Pages

O painel público é gerado pelo workflow `Publicar painel do Radar` a partir do ramo `main`. O repositório já é público; o site também é público e continua **somente de leitura**. O pacote publicado inclui decisões, trechos curtos, links e tabelas consultáveis, mas não republica os textos integrais recuperados. E-mails, CPFs formatados e IDs de grupo são omitidos no arquivo publicado; uma verificação adicional bloqueia o deploy se esses identificadores escaparem.

Um push humano ao `main` publica a nova fotografia. As coletas programadas, a recuperação de textos e o resumo semanal chamam o mesmo workflow após persistirem mudanças, pois commits feitos pelo `GITHUB_TOKEN` não disparam outro workflow de `push`. O site consulta `version.json` a cada cinco minutos enquanto está aberto e também ao voltar para a aba; quando há versão nova, atualiza os dados sem perder a seção em uso. Há alguns minutos de atraso possíveis entre a coleta e a publicação pelo GitHub Pages.

Para conferir o pacote antes do deploy: `npm run dashboard:build:public` e `node scripts/check-public-dashboard.mjs`. O build local padrão (`npm run dashboard:build`) continua preservando o texto integral para auditoria local.
