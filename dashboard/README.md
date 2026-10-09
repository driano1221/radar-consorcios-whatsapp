# Painel de acompanhamento do Radar

Interface estática, **somente de leitura**, para acompanhar os documentos coletados, a triagem, as pendências de identidade e o estado atual da base de consórcios. O visual é inspirado na clareza de uma urna: etapas numeradas, alto contraste, poucos elementos e ações explícitas. Não há login, editor, envio ao WhatsApp nem chamada a APIs externas no navegador.

## Abrir localmente

Na raiz do repositório:

```sh
npm run dashboard:build
npm run dashboard:serve
```

Abra `http://127.0.0.1:4173/`. O servidor aceita conexões **somente deste computador**. Para atualizar a fotografia, sincronize o repositório e execute `dashboard:build` novamente. `dashboard/dist/` é gerado e ignorado pelo Git.

## O que aparece

- **Início:** quantas publicações foram encontradas, quantas têm sugestão ou texto faltante para conferir, quantos consórcios são citados e quantas precisam de conferência de identidade. Registros rejeitados pela triagem e legados sem texto ficam no histórico, mas não inflam a contagem de possíveis achados. “O que a coleta trouxe” separa resultados brutos (podem repetir) de documentos que entraram no acervo desde a rodada anterior e divide o volume entre Google News, Querido Diário, RSS e portais/diários. A caixa “O que ainda falta conferir” mostra conteúdo insuficiente, fontes sem nome no catálogo e falhas da última coleta; fontes desativadas são identificadas à parte.
- **Publicações:** busca e filtros simples: possíveis achados, rejeitados pela triagem, legados sem texto, todas, sem texto suficiente, fora da lista, precisam de conferência e enviadas ao WhatsApp. Cada ficha responde se entrou na lista e por quê, avisa quando só houve título ou nenhum trecho, mostra o motivo da falha de recuperação e abre a fonte original. Textos integrais recuperados aparecem recolhidos na ficha; sugestões feitas a partir deles **não entram automaticamente** na base de eventos. Uma portaria pode apresentar vários consórcios com prova distinta para cada vínculo.
- **Consórcios:** nomes, siglas, CNPJ associado apenas quando o trecho permite, e publicações que citam cada consórcio.

O painel lê as tabelas de `data/catalogo/` e o estado versionado. A categoria e a etapa **revisadas editorialmente** prevalecem sobre o registro bruto. Atos antigos reindexados recentemente permanecem no arquivo histórico, mas não aparecem como eventos atuais. A tela nunca equipara documento, menção ou autorização legal a ingresso/saída efetiva.

## Recuperação de texto

O radar tenta ler até 12 páginas originais por coleta quando o feed trouxe só o título **ou um resumo curto**. Compara Mozilla Readability e Trafilatura; discordância de categoria ou falha de um dos leitores deixa o item em **prévia**. Para links do Google Notícias, resolve primeiro o endereço do veículo; preserva a URL do feed como chave de deduplicação. Conteúdo bloqueado, PDF ou página sem texto relevante não é tratado como recuperado. Se o texto mudar a categoria, o item também fica em prévia e não é enviado automaticamente.

O retroativo pode ser conferido com `node scripts/backfill-article-text.mjs --limit=20` e salvo com `node scripts/backfill-article-text.mjs --limit=20 --apply`. A rotina diária também percorre até 20 títulos antigos do Google Notícias (incluindo uma quarta tentativa controlada), até 10 PDFs e recalcula as sugestões. O texto integral recuperado é preservado em `data/catalogo/textos-artigos.ndjson`, com hash, leitor, URL direta e omissão de CPF/e-mail; `trecho` continua curto para consulta. PDFs com texto geram trechos atribuídos à página em `recuperacao-pdf-google.ndjson`. Nenhuma dessas rotinas envia mensagens ou transforma sugestão em evento confirmado. Fontes indisponíveis continuam marcadas com motivo específico.

## Rastreio de decisões

O radar passa a guardar em `state/news-state.json` um registro compacto das decisões recentes, limitado a 1.500 URLs e 14 dias: motivo, categoria, pontuação, prévia/fila/seleção, data da última coleta e número da execução. Não duplica texto integral nem segredos. Antes da primeira execução persistente com essa mudança, fichas antigas usam o motivo editorial do catálogo ou uma **reclassificação identificada como reconstruída**, que pode diferir da decisão tomada naquela rodada. O log mostra a **última decisão por URL**, não uma auditoria imutável de todas as rodadas nem a deduplicação exata entre URLs diferentes.

## GitHub Pages

**Não ativado.** O usuário escolheu manter o painel privado por enquanto. Mesmo com repositório privado, um site GitHub Pages pessoal pode ficar público; a possibilidade de Pages no repositório privado também depende do plano GitHub. Não criar workflow de deploy, alterar a visibilidade do repositório ou publicar `data.json` sem nova autorização específica e revisão do conteúdo exposto. Uma publicação pública exigiria minimizar dados e remover qualquer informação interna dos registros de triagem.
