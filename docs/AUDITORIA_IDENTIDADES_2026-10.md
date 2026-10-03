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

## Segunda revisão editorial — 02/10/2026

Uma segunda passagem examinou os 30 pendentes da primeira auditoria e separou **identidade** de **validade do evento**. A decisão é armazenada em `data/catalogo/revisoes-eventos.ndjson`, com motivo, evidência e SHA-256 do trecho arquivado. `npm run reviews:seal` lacra novas decisões; se o trecho mudar em uma coleta futura, a decisão antiga deixa de ser aplicada até nova revisão. O arquivo bruto de 1.148 documentos não é apagado nem reescrito com essas decisões.

| Indicador após a segunda revisão | Resultado |
|---|---:|
| Possíveis eventos, após retirar falsos positivos documentados | 50 |
| Falsos eventos excluídos das tabelas derivadas | 18 |
| Categorias corrigidas sem excluir o documento | 4 |
| Consórcios candidatos | 27 |
| Vínculos documento–consórcio | 41 |
| Eventos ainda sem identidade segura | 10 |

Os 18 excluídos incluem rubricas e balanços orçamentários, adesão a atas de preços, campo-modelo de contrato, o consórcio de instituições CESGRANRIO/UFJF e a **extinção de locação do CIENSP**, que não significa fim do consórcio. Casos reais foram preservados: a notícia integral do [Diário do Grande ABC](https://www.dgabc.com.br/noticia/4348436/consorcio-intermunicipal-cria-agenda-setorial-com-brasilia-para-atrair-investimentos) identifica o consórcio existente, mas trata de uma agenda setorial, não de sua criação. A lei de Marília, no PDF p. 2, identifica o CONDESU e **autoriza** o ingresso, sem provar que todas as etapas foram concluídas.

Em Valinhos, a [página oficial do Conselho Municipal de Saúde](https://www.valinhos.sp.gov.br/portal/secretarias-paginas/404/publicacoes/) registra a aprovação de uma *proposta* de ingresso no SAMU Regional Hortolândia/Sumaré: a categoria do evento foi corrigida para `PROPOSTA DE ADESÃO`, mas não foi criada uma identidade jurídica sem nome formal comprovado. O trecho de Votuporanga relativo a cláusulas de rateio deixou de ser `CONTROLE`; permanece `RATEIO` com contrato completo a conferir.

Marília passou de `ADESÃO` para `ADESÃO AUTORIZADA`; o CI-DTSA passou de `CRIAÇÃO` para `CRIAÇÃO EM TRAMITAÇÃO`, pois o protocolo já constava em 2022 e a constituição em agosto de 2026 não foi comprovada pela manchete.

Os dois PDFs antes acima de 25 MiB foram processados em execução separada. Marília (143 páginas) trouxe a Lei 9.498/2026 na p. 2. Maracaju (474 páginas pesquisadas) trouxe apenas menção a “administração de consórcios para aquisição de bens e direitos” em uma tabela de atividades econômicas; **não há evidência textual suficiente para confirmar o protocolo** indicado pelo registro antigo. Maracaju permanece pendente, pois extração de texto não substitui OCR de eventuais páginas digitalizadas. O resultado fica em `data/catalogo/recuperacao-pdf-grandes.ndjson`.

Os dez pendentes são: Apucarana, Piranhas, Maracaju, duas matérias sobre inadimplência municipal em MT, Valinhos (identidade formal não confirmada), Araçariguama, Votuporanga (consórcio do contrato não confirmado), Campo Mourão e Maravilha. Edições estaduais de AL contêm atos de muitos municípios e consórcios; não atribuir o primeiro nome encontrado ao município da manchete. Os três PDFs sem menção pesquisável e Maracaju podem exigir OCR ou consulta ao portal editor. As notícias de MT são eventos relevantes, mas não permitem atribuir cada município a um consórcio específico com a evidência disponível.

Próximo passo analítico: verificar os dez casos remanescentes e validar a amostra dos 12 vínculos automáticos. Não usar o catálogo para inferir composição ou data de adesão sem o ato constitutivo, a ratificação e o marco temporal pertinentes.

## Regressão dos falsos positivos — 03/10/2026

Os 18 documentos marcados `nao_evento` agora são reexecutados em teste automático a partir dos trechos arquivados ou recuperados dos PDFs. Antes do ajuste, cinco ainda eram publicáveis pelas regras locais: Camaquã, Jaboticabal, Candeias, Votuporanga e Senhor do Bonfim. O classificador passou a rejeitar especificamente essas menções normativas, listas orçamentárias e quadros contábeis. O teste também simula uma fila antiga e um resumo semanal com rótulos anteriores: os 18 devem ser removidos da fila e nenhum pode compor o boletim.

Essa proteção atua sobre o **trecho disponível**, não equivale a ler integralmente cada edição. Uma edição pode conter outro ato consorcial legítimo em página diferente; nesse caso, é preciso classificar o excerto desse ato separadamente. Mensagens já enviadas não são apagadas retroativamente.

## Checagem dos vínculos automáticos — 03/10/2026

Ao iniciar a checagem das 12 menções automáticas, a edição de Rio Claro revelou a sigla `CISMESTR` ao lado da denominação “Consórcio Intermunicipal de Saúde na Região Metropolitana de Piracicaba”. O [protocolo publicado em Rio Claro](https://saude-rioclaro.org.br/extrato%20CISAO%20CISMETRO%20PIRACICABA-compactado.pdf) usa **CISMETRO PIRACICABA**, enquanto a [página institucional do CISMETRO Limeira](https://www.cismetrolimeira.com.br/dispensas/) usa denominação semelhante. A sigla do recorte não sustenta a criação de uma terceira identidade, mas ainda não permite escolher com segurança a qual delas o empenho se refere.

O vínculo foi colocado em `revisoes-identidades.ndjson` como **pendente**, com hash do trecho; ele só volta à extração automática se a evidência mudar. A base reconstruída passou de 27 para **26 identidades candidatas**, de 41 para **40 vínculos** e de 10 para **11 documentos sem identidade segura**. Os outros 11 vínculos originalmente automáticos continuam candidatos, não confirmação de composição municipal ou da ocorrência do evento.

## Data de indexação não é data do ato — 03/10/2026

A prévia do resumo semanal mostrou o [Projeto de Lei 54/2022 de Guanhães](https://sapl.guanhaes.mg.leg.br/media/sapl/public/materialegislativa/2022/3821/projeto_de_lei_numero__54_de_2022.pdf) como achado de 28/09/2026. A data veio do item recente no Google Notícias, não do documento legislativo. A votação de 2022 também consta no [SAPL da Câmara](https://sapl.guanhaes.mg.leg.br/relatorios/85/sessao-plenaria-pdf). Por isso, PDFs de atos numerados cujo título explicita ano pelo menos dois anos anterior à data do feed deixam de ser publicáveis e são retirados de boletins gerados a partir de observações antigas. Isso não apaga o documento histórico; corrige apenas seu uso como **notícia nova**. Há regressão específica para coleta, fila e boletim.
