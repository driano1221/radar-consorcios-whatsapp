# Querido Diário: domínio atual e indisponibilidade real — 19/10/2026

## Resultado

**Não restabelecido.** Há duas situações distintas: o cliente ainda priorizava um endereço legado e a API atual está indisponível no servidor. A correção do endereço é necessária, mas não basta para recuperar o serviço agora.

O site atual `https://queridodiario.org.br/env.js` anuncia `https://api.queridodiario.org.br`. Isso também consta nos manifestos oficiais:

- https://github.com/okfn-brasil/querido-diario-deployment/blob/main/k8s/base/frontend/configmap-env.yaml
- https://github.com/okfn-brasil/querido-diario-deployment/blob/main/k8s/base/api/ingressroute.yaml

A documentação antiga ainda cita `api.queridodiario.ok.org.br`, que apresenta erro TLS. A investigação anterior de duas rotas legadas **não havia coberto diretamente o domínio atual**. Este relatório corrige essa lacuna sem invalidar os registros dos testes anteriores.

## Teste real no Actions

[Execução 39331259680](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/39331259680), commit `f86a434`:

| Teste | Resposta |
|---|---|
| Configuração pública do frontend | 200; anuncia a API nova |
| API atual: `/health`, `/openapi.json`, `/gazettes` simples e com busca | 503 `no available server` |
| Proxy `/api` no site atual e legado | Redireciona para API atual, também 503 |
| API legada sob `ok.org.br` | Falha TLS |
| Endpoint de busca anônimo do backend Django | 503 |
| curl HTTP/1.1 + IPv4 | Mesmo 503; não é específico do fetch/Node |
| PDF oficial conhecido no armazenamento | 206, assinatura PDF válida |
| Testes de regressão | **447 aprovados** |
| Acervo, revisões, recibos, fila e sessão | **Intactos; zero mensagens** |

O workflow fica vermelho de propósito se não conseguir obter dados reais: isso não é falha nos 447 testes nem confirmação de que a API voltou. O artefato `querido-diario-diagnosis-*` contém status, destinos dos redirects, diagnóstico curl, configuração anunciada e resultado do coletor.

O armazenamento permite ler PDFs conhecidos, mas sua listagem anônima retornou AccessDenied. Reabrir PDFs históricos não restaura a descoberta de publicações novas. Não existe, neste diagnóstico, um espelho público integral validado que substitua a busca indisponível.

## Alterações no radar

- API nova passa a ser o endereço principal e o padrão do módulo. Fallbacks limitados aos proxies públicos; domínio legado sem TLS válido sai das alternativas padrão.
- Prazo por consulta de 30 segundos e orçamento total de três minutos, para comportar consultas reais lentas quando o serviço voltar.
- Não muda fonte, ID/URL do diário, triagem, deduplicação ou recibos; não há replay de registros antigos.
- Script dedicado `scripts/diagnose-querido-diario.mjs` e workflow de leitura `validate-querido-diario.yml`, sem credenciais de WhatsApp ou IA.

## Dependência externa comprovada

Outro consumidor relatou hoje o mesmo incidente na [issue oficial #113](https://github.com/okfn-brasil/querido-diario-api/issues/113): indisponibilidade desde a madrugada e posterior mudança de 522 para 503. A antiga [issue #110](https://github.com/okfn-brasil/querido-diario-api/issues/110) trata do TLS do domínio legado, não substitui o incidente atual.

Para voltar a pesquisar diários, a equipe do Querido Diário precisa recuperar a aplicação/serviços de busca ou indicar uma instância pública operacional. Não há acesso autorizado do radar ao cluster deles. Com autorização explícita do usuário, o [comentário com evidências foi publicado](https://github.com/okfn-brasil/querido-diario-api/issues/113#issuecomment-6278325588) por `driano1221`, em 19/10/2026, às 21h59 UTC. A publicação foi única, com consulta prévia para evitar duplicação. [Texto preservado](COMENTARIO-QD-113-PROPOSTO.md).
