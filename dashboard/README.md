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

- **Visão geral:** documentos arquivados, eventos candidatos, identidades candidatas, pendências, vínculos e distribuição por tema.
- **Últimas coletas:** busca por título, fonte e consórcio; filtros por entrada na base de eventos, arquivo bruto, envio ao WhatsApp e acompanhamento. Cada ficha mostra motivo, trecho preservado, datas, classificação e fonte original.
- **Para acompanhar:** documentos sem identidade segura e, a partir das próximas execuções persistentes, itens em prévia, fila ou revisão divergente.
- **Consórcios:** nomes, siglas, CNPJ associado apenas quando o trecho permite, e documentos vinculados.

O painel lê as tabelas de `data/catalogo/` e o estado versionado. A categoria e a etapa **revisadas editorialmente** prevalecem sobre o registro bruto. Atos antigos reindexados recentemente permanecem no arquivo histórico, mas não aparecem como eventos atuais. A tela nunca equipara documento, menção ou autorização legal a ingresso/saída efetiva.

## Rastreio de decisões

O radar passa a guardar em `state/news-state.json` um registro compacto das decisões recentes, limitado a 1.500 URLs e 14 dias: motivo, categoria, pontuação, prévia/fila/seleção, data da última coleta e número da execução. Não duplica texto integral nem segredos. Antes da primeira execução persistente com essa mudança, fichas antigas exibem o motivo já presente no catálogo; ele pode ser mais genérico. O log mostra a **última decisão por URL**, não uma auditoria imutável de todas as rodadas nem a deduplicação exata entre URLs diferentes.

## GitHub Pages

**Não ativado.** O usuário escolheu manter o painel privado por enquanto. Mesmo com repositório privado, um site GitHub Pages pessoal pode ficar público; a possibilidade de Pages no repositório privado também depende do plano GitHub. Não criar workflow de deploy, alterar a visibilidade do repositório ou publicar `data.json` sem nova autorização específica e revisão do conteúdo exposto. Uma publicação pública exigiria minimizar dados e remover qualquer informação interna dos registros de triagem.
