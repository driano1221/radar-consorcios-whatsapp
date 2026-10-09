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

- **Triagem:** o acervo acumulado é separado dos documentos novos no dia e na última execução. “Resultados retornados” podem repetir documentos conhecidos; só a primeira entrada conta como documento novo. A lista mostra até 80 registros por seleção, com flags visíveis de confirmação/descarte/candidatura. Quatro filtros mostram pendências independentes da decisão.
- **Publicações:** arquivo pesquisável com filtros. A ficha mostra primeiro o resultado, o motivo, a prova disponível e o destino no WhatsApp. Datas, vínculos, demais trechos de PDF e detalhes técnicos ficam em “Ver todas as datas, vínculos e detalhes da análise”. Texto recuperado e sugestões não viram automaticamente fatos confirmados.
- **Base completa:** todas as linhas e colunas de `eventos.csv`, `consorcios.csv`, `participacoes.csv`, `vinculos-documentos.csv`, `identidade-pendente.csv`, `arquivo-coletas.ndjson` e `revisoes-eventos.ndjson`. A lista resume os campos principais sem rolagem horizontal; a ficha exibe **todas as colunas**, inclusive vazias como “Não informado”. Há busca e glossário.
- **Como funciona:** um diagrama localiza coleta, leitura, regras, decisão da base e a segunda leitura opcional da IA antes do WhatsApp. O cadastro de fontes é gerado da configuração atual e distingue ativas, em prévia e desativadas. Falhas da última coleta ficam recolhidas ao final.

O painel lê as tabelas de `data/catalogo/` e o estado versionado. A categoria e a etapa **revisadas editorialmente** prevalecem sobre o registro bruto. Atos antigos reindexados recentemente permanecem no arquivo histórico, mas não aparecem como eventos atuais. A tela nunca equipara documento, menção ou autorização legal a ingresso/saída efetiva.

**Meta de qualidade ainda não concluída:** reduzir candidatos e pendências até que quase todo documento seja aceito ou descartado com justificativa e evidência. Candidato deve ser exceção temporária para insuficiência real de prova ou conflito relevante. A interface não pode “zerar” pendências apenas trocando o rótulo: recuperar texto, conferir identidade, resolver divergências e reprocessar o acervo com testes de regressão. A fotografia atual ainda contém casos a conferir.

## Direção visual

O estudo local `dashboard/prototypes/compare.html` compara três abordagens com a mesma fotografia de dados: Registro, Mesa e Caderno. A versão implementada segue **Registro**, com lista densa, títulos editoriais, separadores finos e evidência em destaque. A versão anterior inspirada no Windows XP foi descontinuada. O fluxo usa a contenção visual sugerida por [Diagram Design](https://github.com/cathrynlavery/diagram-design); a revisão eliminou a janela falsa e a dependência de hover observadas no guia [Hallmark](https://github.com/Nutlope/hallmark). [CursorFX](https://github.com/devkancheti4-design/cursorfx) foi examinado, mas efeitos de cursor e som não foram incorporados ao painel de leitura. [Dembrandt](https://github.com/dembrandt/dembrandt) também foi examinado, sem extrair nem reproduzir a identidade visual de sites terceiros.

## Recuperação de texto

O radar tenta ler até 12 páginas originais por coleta quando o feed trouxe só o título **ou um resumo curto**. Compara Mozilla Readability e Trafilatura; discordância de categoria ou falha de um dos leitores deixa o item em **prévia**. Para links do Google Notícias, resolve primeiro o endereço do veículo; preserva a URL do feed como chave de deduplicação. Conteúdo bloqueado, PDF ou página sem texto relevante não é tratado como recuperado. Se o texto mudar a categoria, o item também fica em prévia e não é enviado automaticamente.

O retroativo pode ser conferido com `node scripts/backfill-article-text.mjs --limit=20` e salvo com `node scripts/backfill-article-text.mjs --limit=20 --apply`. A rotina diária também percorre até 20 títulos antigos do Google Notícias (incluindo uma quarta tentativa controlada), até 10 PDFs e recalcula as sugestões. O texto integral recuperado é preservado em `data/catalogo/textos-artigos.ndjson`, com hash, leitor, URL direta e omissão de CPF/e-mail; `trecho` continua curto para consulta. PDFs com texto geram trechos atribuídos à página em `recuperacao-pdf-google.ndjson`. Nenhuma dessas rotinas envia mensagens ou transforma sugestão em evento confirmado. Fontes indisponíveis continuam marcadas com motivo específico.

## Rastreio de decisões

O radar passa a guardar em `state/news-state.json` um registro compacto das decisões recentes, limitado a 1.500 URLs e 14 dias: motivo, categoria, pontuação, prévia/fila/seleção, data da última coleta e número da execução. Não duplica texto integral nem segredos. Antes da primeira execução persistente com essa mudança, fichas antigas usam o motivo editorial do catálogo ou uma **reclassificação identificada como reconstruída**, que pode diferir da decisão tomada naquela rodada. O log mostra a **última decisão por URL**, não uma auditoria imutável de todas as rodadas nem a deduplicação exata entre URLs diferentes.

## GitHub Pages

O painel público é gerado pelo workflow `Publicar painel do Radar` a partir do ramo `main`. O repositório já é público; o site também é público e continua **somente de leitura**. O pacote publicado inclui decisões, trechos curtos, links e tabelas consultáveis, mas não republica os textos integrais recuperados. E-mails, CPFs formatados e IDs de grupo são omitidos no arquivo publicado; uma verificação adicional bloqueia o deploy se esses identificadores escaparem.

Um push humano ao `main` publica a nova fotografia. As coletas programadas, a recuperação de textos e o resumo semanal chamam o mesmo workflow após persistirem mudanças, pois commits feitos pelo `GITHUB_TOKEN` não disparam outro workflow de `push`. O site consulta `version.json` a cada cinco minutos enquanto está aberto e também ao voltar para a aba; quando há versão nova, atualiza os dados sem perder a seção em uso. Há alguns minutos de atraso possíveis entre a coleta e a publicação pelo GitHub Pages.

Para conferir o pacote antes do deploy: `npm run dashboard:build:public` e `node scripts/check-public-dashboard.mjs`. O build local padrão (`npm run dashboard:build`) continua preservando o texto integral para auditoria local.
