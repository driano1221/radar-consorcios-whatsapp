# Comentário publicado na issue #113

Destino: https://github.com/okfn-brasil/querido-diario-api/issues/113

Publicado com autorização explícita do usuário por `driano1221`, em 19/10/2026, às 21h59 UTC: https://github.com/okfn-brasil/querido-diario-api/issues/113#issuecomment-6278325588

---

Também confirmamos a indisponibilidade em um projeto de pesquisa que consome o Querido Diário.

Teste de 19/10/2026, às 21h56 UTC (18h56 de Brasília), em runner Ubuntu do GitHub Actions:

- O frontend público anuncia `https://api.queridodiario.org.br` em `https://queridodiario.org.br/env.js`.
- `/health`, `/openapi.json`, `/gazettes?size=1` e uma busca simples retornam **503**, com corpo `no available server`.
- As rotas `/api` dos domínios principal e legado redirecionam para o domínio atual e têm o mesmo resultado.
- A rota pública `backend-api.queridodiario.org.br/api/querido_diario/gazettes/?size=1` também retorna 503.
- Reproduzido com Node.js 22 e curl em HTTP/1.1 + IPv4. Um PDF público conhecido em `data.queridodiario.ok.org.br` continua acessível (206 para Range), indicando que os arquivos permanecem disponíveis enquanto a busca está indisponível.

Diagnóstico reproduzível e artefato JSON: https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/39331259680. Os 447 testes de regressão da aplicação passaram; a etapa de rede foi marcada como falha por não obter diários reais. Nenhuma mensagem foi enviada.

Há previsão de restabelecimento ou alguma instância pública temporária que vocês recomendem? Podemos repetir os testes após a recuperação e informar o resultado por aqui.
