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

- **Triagem:** lista das decisões já registradas, com filtro por confirmadas/fora da base/candidatas, busca e ficha de justificativa e evidência. A lista mostra até 80 registros por seleção; o arquivo completo contém todos. Quatro filtros adicionais mostram pendências de informação: identidade incompleta, fonte em teste, leitura divergente e nova pista no texto. São marcadores independentes da decisão: um registro descartado pode ter pista nova sem virar automaticamente um achado.
- **Publicações:** arquivo pesquisável com filtros. Cada ficha mostra a decisão de base **separada** da decisão de alerta, o motivo, a prova, eventuais páginas de PDF e a fonte original. Texto recuperado e sugestões não viram automaticamente fatos confirmados.
- **Base completa:** todas as linhas e colunas de `eventos.csv`, `consorcios.csv`, `participacoes.csv`, `vinculos-documentos.csv`, `identidade-pendente.csv`, `arquivo-coletas.ndjson` e `revisoes-eventos.ndjson`. Há busca por tabela, prévia integral da linha e glossário de todas as colunas, mesmo que a tabela ou as células estejam vazias. Célula vazia aparece como “Não informado”. A ordem visual prioriza título/nome e decisão; nenhum campo é removido.
- **Como funciona:** coleta, extração, classificação, destinos separados, papel limitado do DeepSeek, regras principais e próximos passos. Fontes com erro ficam recolhidas ao final para não poluir a leitura principal.

O painel lê as tabelas de `data/catalogo/` e o estado versionado. A categoria e a etapa **revisadas editorialmente** prevalecem sobre o registro bruto. Atos antigos reindexados recentemente permanecem no arquivo histórico, mas não aparecem como eventos atuais. A tela nunca equipara documento, menção ou autorização legal a ingresso/saída efetiva.

## Direção visual

O estudo local `dashboard/prototypes/compare.html` compara três abordagens com a mesma fotografia de dados: Registro, Mesa e Caderno. A versão implementada segue **Registro**, com lista densa, títulos editoriais, separadores finos e evidência em destaque. A versão anterior inspirada no Windows XP foi descontinuada. O fluxo usa a contenção visual sugerida por [Diagram Design](https://github.com/cathrynlavery/diagram-design); a revisão eliminou a janela falsa e a dependência de hover observadas no guia [Hallmark](https://github.com/Nutlope/hallmark). [CursorFX](https://github.com/devkancheti4-design/cursorfx) foi examinado, mas efeitos de cursor e som não foram incorporados ao painel de leitura. [Dembrandt](https://github.com/dembrandt/dembrandt) também foi examinado, sem extrair nem reproduzir a identidade visual de sites terceiros.

## Recuperação de texto

O radar tenta ler até 12 páginas originais por coleta quando o feed trouxe só o título **ou um resumo curto**. Compara Mozilla Readability e Trafilatura; discordância de categoria ou falha de um dos leitores deixa o item em **prévia**. Para links do Google Notícias, resolve primeiro o endereço do veículo; preserva a URL do feed como chave de deduplicação. Conteúdo bloqueado, PDF ou página sem texto relevante não é tratado como recuperado. Se o texto mudar a categoria, o item também fica em prévia e não é enviado automaticamente.

O retroativo pode ser conferido com `node scripts/backfill-article-text.mjs --limit=20` e salvo com `node scripts/backfill-article-text.mjs --limit=20 --apply`. A rotina diária também percorre até 20 títulos antigos do Google Notícias (incluindo uma quarta tentativa controlada), até 10 PDFs e recalcula as sugestões. O texto integral recuperado é preservado em `data/catalogo/textos-artigos.ndjson`, com hash, leitor, URL direta e omissão de CPF/e-mail; `trecho` continua curto para consulta. PDFs com texto geram trechos atribuídos à página em `recuperacao-pdf-google.ndjson`. Nenhuma dessas rotinas envia mensagens ou transforma sugestão em evento confirmado. Fontes indisponíveis continuam marcadas com motivo específico.

## Rastreio de decisões

O radar passa a guardar em `state/news-state.json` um registro compacto das decisões recentes, limitado a 1.500 URLs e 14 dias: motivo, categoria, pontuação, prévia/fila/seleção, data da última coleta e número da execução. Não duplica texto integral nem segredos. Antes da primeira execução persistente com essa mudança, fichas antigas usam o motivo editorial do catálogo ou uma **reclassificação identificada como reconstruída**, que pode diferir da decisão tomada naquela rodada. O log mostra a **última decisão por URL**, não uma auditoria imutável de todas as rodadas nem a deduplicação exata entre URLs diferentes.

## GitHub Pages

**Não ativado.** O usuário escolheu manter o painel privado por enquanto. Mesmo com repositório privado, um site GitHub Pages pessoal pode ficar público; a possibilidade de Pages no repositório privado também depende do plano GitHub. Não criar workflow de deploy, alterar a visibilidade do repositório ou publicar `data.json` sem nova autorização específica e revisão do conteúdo exposto. Uma publicação pública exigiria minimizar dados e remover qualquer informação interna dos registros de triagem.
