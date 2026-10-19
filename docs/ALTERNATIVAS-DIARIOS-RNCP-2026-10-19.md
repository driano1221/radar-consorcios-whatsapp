# Coleta independente do Querido Diário — 19/10/2026

## O que muda

O Querido Diário continua com diagnóstico próprio e não foi substituído por um espelho fictício. Os conectores abaixo consultam os próprios editores oficiais, independentemente da API indisponível. Essa cobertura regional é complementar, não equivale à cobertura nacional do Querido Diário.

| Fonte | Antes | Integração validada |
|---|---|---|
| AMM-MG / Diário Municipal | Só índice da última edição/PDF, sem análise do conteúdo pelo coletor | Busca pública por palavra-chave + íntegra de cada matéria em HTML |
| AMA-AL / Diário Municipal | Descoberta eventual por Google | Busca e leitura direta de atos |
| AMP-PR / Diário Municipal | Descoberta eventual por Google | Busca e leitura direta de atos |
| FEMURN-RN / Diário Municipal | Descoberta eventual por Google | Busca e leitura direta de atos |
| DOM/SC / CIGA Dados Abertos | Notícias institucionais do CIGA, não a exportação dos diários | Pacotes oficiais CKAN com texto dos atos, sem rastrear o frontend DOM/SC |
| RNCP | Busca Google; índice direto desativado por 403 antigo | Leitor corrigido e validado localmente; acesso direto **continua desativado no Actions**, por bloqueio confirmado |

O CIGA institucional já existia e permanece separado da nova fonte de diários. A AMM-MT, SAPL e os outros conectores existentes também permanecem.

## Fontes públicas verificadas

- Formulários de pesquisa oficiais: [MG](https://www.diariomunicipal.com.br/amm-mg/pesquisar), [AL](https://www.diariomunicipal.com.br/ama/pesquisar), [PR](https://www.diariomunicipal.com.br/amp/pesquisar) e [RN](https://www.diariomunicipal.com.br/femurn/pesquisar). GET, sem conta, chave de API ou serviço pago novo.
- [Catálogo de dados do CIGA](https://dados.ciga.sc.gov.br/dataset/): API CKAN `package_show`, pacotes mensais `domsc-publicacoes-de-MM-AAAA`. Em outubro, a exportação contém autopublicações e atos da edição ordinária, com código, data, município, editor, texto e link oficial. Um pacote pode não conter edição ordinária; isso não é erro.
- [RNCP](https://www.rncp.org.br/noticias): 112 entradas encontradas localmente; a mais recente do índice observado é de **08/09/2026**, não uma notícia nova de outubro. O site é uma associação representativa e não deve ser inventado como um consórcio da base.
- DOM/SC: busca, RSS e rota de texto existem, mas `robots.txt` restringe rastreadores gerais. A integração escolhida usa o catálogo de dados abertos, não essa rota restrita. A API de integração para publicação de atos exige adesão e não é uma API anônima de busca.

## Fluxo e proteção

1. Pesquisar `consórcio` na janela configurada. Nos quatro portais SIGPub, conferir que o filtro foi aplicado, ler código/data/edição/editor e seguir somente links individuais do mesmo portal.
2. Conferir código e data novamente na íntegra; ler só `#materia`, sem menus, rodapé de autenticação ou scripts. Guardar o corpo completo, não apenas o resumo da busca. HTML acima de 8 MB fica sinalizado, sem truncamento silencioso.
3. No CIGA, baixar somente ZIPs recentes do domínio oficial. Python padrão lê um único JSON em memória, sem extrair arquivos em disco. Limites: 12 MB compactados, 80 MB expandidos e 20 MB de saída filtrada. Nomes inesperados, arquivo cifrado e caminho de travessia são recusados.
4. Remover metadados HTML antes de filtrar consórcios. Unificar códigos repetidos entre pacotes. URL original do ato e URL do ZIP ficam separadas; o painel pode mostrar a rota real de leitura.
5. Usar a classificação, guardas editoriais, revisão por DeepSeek, prova literal e deduplicação já existentes. Coletar um documento **não o transforma automaticamente em fato confirmado**. A validação de IA adicional é uma simulação: não aplica revisões ao acervo.
6. Persistir as íntegras, com hash e origem, pelas rotinas normais. Cache de matéria SIGPub só reutiliza mesma URL/editor, hash válido e data original igual. Não sobrescrever prova editorial lacrada.
7. Alertas das fontes recém-habilitadas somente para publicações originais a partir de **20/10/2026, 00h de Brasília**. Isso vale também quando o Google reencontra uma URL antiga e para o resumo semanal. Recibos, fila e sessão anteriores não são reiniciados.

## Limites explícitos

- SIGPub: até duas páginas por portal por rodada, até 60 leituras e orçamento de 90 segundos. Os quatro portais compartilham espaçamento mínimo entre pedidos. Mais páginas ou leitura pendente são indicadas no diagnóstico; não chamar uma busca limitada de cobertura completa. Íntegras já preservadas podem ser reutilizadas nas próximas passagens.
- CIGA: até três exportações recentes por rodada; atualização depende da publicação dos pacotes. Não recupera automaticamente todos os ZIPs dos sete dias nem todos os anos históricos.
- Falha/limite de acesso não vira descarte temático. Um resumo sem íntegra continua bloqueado para envio. Isso não dispensa aprimoramentos futuros da triagem.
- RNCP: no Actions, notícias, home com/sem `www`, sitemap e curl HTTP/1.1/IPv4 retornaram **403 / Just a moment**. Não foram importados cookies, resolvidos desafios ou acessadas rotas privadas. Manter Google como descoberta; para coleta direta contínua nesse runner, é necessária uma rota pública liberada pelo portal (feed/API ou liberação de acesso). O leitor local pronto não comprova acesso no servidor.

## Validação

- Local: **464 testes passaram**, incluindo 17 testes novos de fontes, proveniência, busca vazia, bloqueio, paginação, cache, ZIP, datas e proteção de histórico.
- Replay comparativo do classificador em **2.090 documentos / 2.094 leituras**, com **298 íntegras históricas**: 145 leituras relevantes antes e depois; **zero decisões recalculadas diferentes** no acervo. A nova grafia “fica autorizado o ingresso” foi coberta por regressão sem reescrever registros.
- Coleta local: MG 50, AL 12, PR 50, RN 50 e SC 26 atos, todos com texto. Uma amostra histórica RNCP leu quatro de cinco corpos; uma página curta ficou em prévia. Os números são resultados da busca/amostra, não novos fatos homologados nem publicações enviadas.
- **Actions aprovado:** [execução 39336621942](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/39336621942), código `3da5d82`: 464 testes; **188 documentos únicos com texto** (50 MG, 12 AL, 50 PR, 50 RN e 26 SC), zero só com resumo nessa amostra; bloqueio RNCP registrado corretamente. MG e PR sinalizaram mais páginas disponíveis, não falha de leitura dos 50 documentos examinados em cada um.
- O teste de IA usou **cinco exemplos públicos**, sem persistir decisões ou cache: cinco respostas com evidência literal no corpo. Não é uma medição de precisão de todo o acervo nem altera automaticamente os 15 candidatos das regras puras nessa amostra.

| Exemplo real | Regra inicial | Segunda revisão conferida |
|---|---|---|
| [Decreto 6716/2026, Santa Bárbara/MG](https://www.diariomunicipal.com.br/amm-mg/materia/A54CFAEC) | Rateio | Fora: crédito orçamentário genérico |
| [Lei 027/2026, crédito suplementar/PR](https://www.diariomunicipal.com.br/amp/materia/3DC37B4C) | Rateio | Fora: rubrica não prova contrato |
| [Inexigibilidade 16/2026, Bom Sucesso do Sul/PR](https://www.diariomunicipal.com.br/amp/materia/E8656463) | Adesão | Fora: compra de fornecedor |
| [Contrato de rateio 2026025/001, CIMOP/RN](https://www.diariomunicipal.com.br/femurn/materia/9D13CAC8) | Adesão | Rateio publicado, não ingresso novo |
| [Lei 2919/2026, alteração do protocolo/RN](https://www.diariomunicipal.com.br/femurn/materia/82BE246D) | Crise | Protocolo, não crise consumada |

A simulação completa do radar coletou **272 itens** de todas as fontes, com **zero novos candidatos a envio e zero mensagens**. Gerou o painel público e confirmou invariantes: 2.090 documentos, 228 revisões, atos, provas lacradas, recibos, fila e sessão intactos. Não importou os 188 documentos de teste para o catálogo; as próximas coletas regulares farão sua persistência pelo fluxo normal.

Ensaios anteriores `39335620204` e `39336114053` ficaram vermelhos ao revelar o bloqueio da RNCP; essa limitação não foi ocultada. A execução intermediária `39336527354` foi cancelada em favor da validação final ampliada, para evitar coleta de teste redundante.

Scripts: `validate-direct-gazettes.mjs`, `validate-direct-gazettes-ai.mjs`, `probe-rncp-access.mjs`. Workflow: `validate-direct-gazettes.yml`. A validação não altera `data/` ou `state/`, nem possui sessão ou credenciais de WhatsApp.
