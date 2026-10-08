# Revisão conjunta — 7 de outubro de 2026

Atualização em 08/10: os quatro casos foram revisados conjuntamente e registrados em `data/catalogo/revisoes-eventos.ndjson`, com motivo, evidência, fatos estruturados e hash do trecho arquivado. A revisão de Marcelândia e Alto Paraguai também foi cotejada com a publicação oficial. Isso valida estes casos específicos, **não toda a base**.

## Situação operacional

- As falhas de 5/10 foram do GitHub Actions, antes de o robô iniciar. As execuções seguintes voltaram a concluir: [radar #512](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/37661955570), [sessão #24](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/37663040939) e [recuperação de textos #3](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/37631356292).
- A base local reconstruída reúne 1.500 documentos e 70 possíveis eventos; apenas 3 registros têm revisão editorial positiva explícita nesta rodada. Os demais **não são 70 fatos confirmados**.

## Casos para decidir, nesta ordem

### 1. Umuarama/PR — aprovação ou ingresso efetivo?

- Fonte: [notícia de 6/10](https://portalumuaramanews.com.br/2026/10/06/camara-aprova-adesao-de-umuarama-a-consorcio-de-prevencao-a-desastres/) e [notícia anterior, sobre a votação](https://portalumuaramanews.com.br/2026/10/05/apos-temporais-camara-de-umuarama-vota-adesao-a-consorcio-para-prevenir-desastres-climaticos/).
- Na base: `ADESÃO`, ainda como relato a conferir. Documento `07d6615f`.
- Decidir: qual consórcio é citado? A Câmara **apenas autorizou/aprovou** a participação ou há comprovação de ingresso efetivo? As duas notícias descrevem o mesmo evento em etapas diferentes?
- Resultado a registrar: categoria e etapa corretas; um único evento com duas fontes, se forem duplicatas.

### 2. Marcelândia/MT — alteração de protocolo do CIDESPA

- Fonte: [Lei Municipal nº 1.261/2026](https://amm.diariomunicipal.org/publicacao/1920936/).
- Na base: `ADESÃO`, candidato sem confirmação manual. Documento `64146b92`.
- Decidir: a lei ratifica **somente uma alteração do protocolo de intenções** ou também comprova nova adesão/composição do CIDESPA? Identificar o dispositivo exato e o município a que se aplica.
- Resultado a registrar: manter `ADESÃO` apenas se o texto comprovar ingresso; caso contrário, corrigir para `PROTOCOLO` ou outra categoria apropriada, com trecho de evidência.

### 3. Alto Paraguai/MT — contrato de rateio nº 055/2026

- Fonte: [publicação oficial](https://amm.diariomunicipal.org/publicacao/1919732/).
- Na base: `RATEIO`, candidato sem confirmação manual. Documento `35799042`.
- Decidir: o texto contém um **contrato de rateio assinado/celebrado** entre Alto Paraguai e o consórcio, ou apenas menção contábil? Conferir nome/CNPJ do consórcio, vigência, partes e eventual valor.
- Resultado a registrar: validar o vínculo documental e os campos extraíveis; não inferir adesão nova a partir do rateio.

### 4. Patos de Minas/MG — “questiona criação”

- Fonte: [reportagem sobre depoimento do ex-presidente do CISALP](https://www.patosja.com.br/Pol%C3%ADtica/ex-presidente-do-cisalp-depoe-a-cpi-da-saude-e-questiona-criacao-de-novo-consorcio-em-patos-de-minas).
- Na base: `CRIAÇÃO`, candidato sem confirmação manual. Documento `850762ca`.
- Decidir: existe ato de constituição de um consórcio novo ou a criação foi apenas questionada/aventada em um depoimento?
- Resultado a registrar: se não há constituição comprovada, remover o rótulo `CRIAÇÃO` e usar este caso como teste de falso positivo.

## Como fecharemos cada caso

Para cada documento, registrar: **decisão** (confirmar, corrigir ou descartar), **trecho literal de evidência**, **URL oficial** quando houver, **data do ato** e **limite da conclusão** (por exemplo, “adesão autorizada, ingresso não comprovado”). Só depois aplicar correções à base e aos testes do classificador.

## Resultado da primeira rodada conjunta (08/10)

1. **Umuarama / Conclima:** a matéria de 06/10 confirma que a Câmara aprovou em dois turnos o projeto de ratificação. Aceita como `ADESÃO AUTORIZADA`, etapa legislativa; não presumir ingresso efetivado. A matéria de 05/10 só previa a votação, portanto fica fora da lista de eventos independentes e aponta para a posterior.
2. **Marcelândia / CIDESPA:** a Lei 1.261/2026 ratifica alteração do protocolo e delega o SIM. O Anexo I lista Marcelândia entre os municípios consorciados. Aceita como `GOVERNANÇA` e participação documentada; não há prova de que a **adesão nova** ocorreu em 2026.
3. **Alto Paraguai / CISCN:** contrato de rateio 055/2026 celebrado, R$ 200.010,82, vigência de 02/10/2026 a 02/10/2027. Aceito como `RATEIO`; o CNPJ 03.648.532/0001-28 é do município, não do consórcio.
4. **Patos de Minas:** criação apenas questionada em depoimento. Descartado como evento de criação; a notícia continua no arquivo bruto para auditoria.

O painel local agora diferencia achado aceito, descartado e ainda não conferido, além de mostrar justificativa e fatos. As revisões estão lacradas ao trecho armazenado. A identificação canônica dos três consórcios no cadastro e uma fila de revisão interativa ainda são etapas posteriores; a revisão editorial **não** equivale a uma tabela histórica completa de membros.
