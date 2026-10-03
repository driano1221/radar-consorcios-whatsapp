# Auditoria da base de consórcios — 02/10/2026

## Escopo e resultado

O arquivo histórico contém 1.148 documentos; 68 foram classificados como possíveis eventos de consórcios. A auditoria percorreu **os 68 registros candidatos**, usando o trecho arquivado, a manchete, a fonte original ou o PDF recuperado. Isso **não** equivale a afirmar que os 1.148 documentos foram lidos integralmente ou que os 68 eventos foram confirmados juridicamente.

| Indicador | Antes | Depois |
|---|---:|---:|
| Identidades candidatas | 8 | 26 |
| Documentos com vínculo de identidade | 8 | 38 |
| Vínculos documentais (um documento pode citar dois consórcios) | 8 | 39 |
| Documentos ainda sem identidade segura | 60 | 30 |

Dos 39 vínculos, 27 vêm de fonte complementar conferida e 12 são extrações automáticas que continuam candidatas. Nome e CNPJ identificam a entidade; não provam automaticamente adesão efetiva, pagamento, saída concluída ou criação na data da notícia.

## Como a revisão foi feita

1. O extrator continua exigindo denominação contextualizada; manchete cortada, “consórcio intermunicipal” genérico, rubrica orçamentária e sigla desconhecida não criam entidade.
2. Foram corrigidas variantes de escrita: sigla antes do nome (CONSIRC), hífen sem espaço (CISMESTR) e sigla já conhecida em contexto de consórcio (CONAGRESTE). Há testes de regressão para esses casos.
3. O workflow isolado `auditar-identidades.yml` leu 34 PDFs antigos do Querido Diário sem enviar WhatsApp: 29 renderam trechos, 3 não trouxeram a palavra buscada e 2 excederam o limite de 25 MiB. Saída: `data/catalogo/recuperacao-pdf.ndjson`, com página e trecho; não é uma tabela de fatos confirmados.
4. Fontes acessíveis pela web complementaram notícias sem texto. A intervenção fica em `data/catalogo/evidencias-complementares.ndjson`, sempre com documento, nome, URL e justificativa. O CSV de vínculos guarda separadamente `url` da notícia e `url_evidencia` da identificação.
5. A reconstrução `npm run catalog:update` é repetível. Itens sem lastro ficam em `data/catalogo/identidade-pendente.csv` em vez de receberem nome adivinhado.

## Achados e ressalvas importantes

- Dracena/CISNAP (PDF p. 2), Costa Rica/COINTA (pp. 8–10), Campo Belo/CISMARG (p. 26) e Contagem/ICISMEP (p. 38) agora têm vínculo rastreável.
- O documento de Salinas cita **dois** consórcios na mesma página, CIMES e CISRUN; o modelo admite dois vínculos sem duplicar o documento.
- O caso Serra Azul tem nome formal no [protocolo publicado em Itupeva](https://www.dosp.com.br/impressao.php?i=MzAwNDYx): Consórcio Público Intermunicipal Distrito Turístico Serra Azul (CI-DTSA). O protocolo é anterior à manchete de 2026; esta não basta para datar a constituição.
- A [Lei 3.108/2022 de Guanhães](https://www.guanhaes.mg.leg.br/legislacao/2621) resolve uma manchete truncada sobre o CIS-URG Médio Piracicaba.
- As notícias de Inhapi, Mata Grande e Novo Lino **autorizam** adesão ao CONAGRESTE; não confirmam, isoladamente, a conclusão de cada ingresso. O mesmo cuidado vale para a autorização de retirada de Campo Belo do CISMARG.
- O PDF de Andradina fala em **extinção amigável de um contrato de locação do CIENSP**, não extinção do consórcio. O de Niterói menciona um consórcio de entidades contratadas (CESGRANRIO/UFJF), não um consórcio intermunicipal. Ambos permanecem sem vínculo de identidade nesta base e são casos de regressão editorial a tratar no classificador.
- Várias edições têm apenas previsão de “rateio pela participação em consórcio público”, adesão a **ata de registro de preços**, ou cláusula-modelo. Isso não prova novo contrato de rateio nem entrada/saída de município.

## O que ainda está pendente

Os 30 itens de `identidade-pendente.csv` incluem 9 com trecho insuficiente e 21 sem trecho arquivado. Entre estes últimos há PDFs grandes, PDFs sem texto extraído e fontes que não nomeiam um consórcio específico. As duas notícias sobre municípios de MT inadimplentes descrevem um programa estadual e oito municípios, mas não identificam com segurança **qual consórcio** corresponde a cada um; não foi inventado vínculo. Edições estaduais extensas exigem localizar o ato municipal específico dentro do PDF antes de associar sua manchete a qualquer consórcio que apareça no mesmo arquivo.

Próxima etapa: registrar decisão editorial por evento (`confirmado`, `não evento` ou `pendente`) com evidência e reprocessar os dois PDFs acima de 25 MiB por página/faixa, sem ampliar indiscriminadamente o download. Depois validar por amostragem humana os 12 vínculos automáticos e os 27 complementares antes de usar a base em análise IPEA ou inferir composição histórica.

## Reproduzir

```powershell
npm run catalog:update
npm test
npm run check
```

O workflow de recuperação é manual, limitado, usa PDFs públicos e grava somente trechos com página em ramo separado; não envia mensagens nem altera a base principal sem revisão.
