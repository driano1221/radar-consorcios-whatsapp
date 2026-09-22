# Diagnóstico de saúde — 22/09/2026

## Evidência antes da correção

- Entre 14 e 22/09, o [workflow do radar](https://github.com/driano1221/radar-consorcios-whatsapp/actions/workflows/radar.yml), embora configurado para uma execução por hora, realizou entre cinco e sete coletas agendadas por dia. A [documentação do GitHub](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows) informa que agendamentos podem atrasar ou ser descartados sob carga. O minuto 17 já evitava o início da hora; não foi identificada falha no código do coletor que explicasse os disparos ausentes.
- A [coleta de 22/09](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/35770107163) reuniu 76 itens e publicou uma notícia. Portanto, sessão e envio estavam operacionais.
- O caminho `https://consorciociga.gov.br/feed/` passou a responder HTML 200, inválido como RSS. A API do mesmo órgão em [`/api/artigos`](https://consorciociga.gov.br/api/artigos) respondeu JSON, com a data editorial no campo `data`, paginação e conteúdo completo. Em 22/09, sua primeira página não continha notícia publicada na janela de sete dias. Não se confundiu o CIGA catarinense com o domínio semelhante `consorciociga.com.br`, de outro consórcio.
- As três consultas do Querido Diário falharam com 503 nas duas últimas coletas. Uma consulta mínima ao endereço configurado redirecionou ao host novo `api.queridodiario.org.br`, que estava indisponível. A [documentação da API](https://github.com/okfn-brasil/querido-diario-api) ainda aponta o endereço do projeto. Em outras coletas, as três consultas retornaram normalmente. Trata-se de oscilação da origem; o robô já registra erro por consulta, mantém as demais fontes e repete a janela de sete dias após recuperação.
- Os logs exibiram erros `MessageCounterError` e `Bad MAC` ao tentar descriptografar mensagens recebidas. A [checagem da sessão](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/35749039633) encontrou o grupo, e a coleta seguinte publicou. Esses erros não demonstraram falha de envio; não foram ocultados nem se removeu a sessão válida. Há [ocorrências semelhantes no projeto Baileys](https://github.com/WhiskeySockets/Baileys/issues/1754).
- O [resumo semanal de 19/09](https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/35452293342) foi enviado e está confirmado no estado persistido.

## Correções aplicadas

1. Quatro horários de tentativa por hora, nos minutos 11, 26, 41 e 56. Uma checagem do histórico antes da instalação das dependências dispensa disparos redundantes por 50 minutos. A frequência real depende do agendador do GitHub e deve ser medida novamente nos próximos dias.
2. CIGA usa sua API de artigos, página ordenada por `data:desc`, com validação do formato. A data editorial determina elegibilidade; `createdAt` e `publishedAt` da migração do CMS não são usados para transformar artigos antigos em notícias novas. URLs seguem as rotas públicas `/blog/noticias/:slug`, `/blog/eventos/:slug` e `/blog/boas-praticas/:slug`.
3. README corrigido para distinguir horário programado de execução efetiva e registrar a indisponibilidade externa do Querido Diário.

O Querido Diário e a descriptografia das mensagens recebidas ainda exigem observação. Nenhuma alteração no código local pode garantir que a API externa responderá ou eliminar um erro da biblioteca de WhatsApp sem arriscar uma sessão que está enviando normalmente.
