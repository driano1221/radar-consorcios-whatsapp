import test from 'node:test';
import assert from 'node:assert/strict';
import { displayTitle, formatWhatsAppMessage } from '../src/lib/format.mjs';

test('formata mensagem curta com fonte e link', () => {
  const message = formatWhatsAppMessage({
    kind: 'news',
    title: 'Município entra em consórcio regional',
    summary: 'A Câmara aprovou a participação municipal.',
    source: 'Prefeitura de Exemplo',
    publishedAt: '2026-08-14T12:00:00-03:00',
    url: 'https://exemplo.gov.br/noticia',
    stateCode: 'MG',
    classification: { category: 'ADESÃO', emoji: '🟦' },
  });
  assert.match(message, /Prefeitura de Exemplo/);
  assert.match(message, /https:\/\/exemplo\.gov\.br\/noticia/);
  assert.match(message, /^\*RADAR CONSÓRCIOS\*\n🟦 \*ADESÃO A CONSÓRCIO\*/);
  assert.match(message, /> A Câmara aprovou a participação municipal\./);
  assert.match(message, /_14 ago\. 2026 · Prefeitura de Exemplo_/);
  assert.doesNotMatch(message, /\]\(https?:\/\//);
});

test('cria manchete específica para ato oficial', () => {
  assert.equal(
    displayTitle({
      kind: 'gazette',
      territoryName: 'Marília',
      classification: { category: 'ADESÃO' },
      title: 'Diário Oficial de Marília',
    }),
    'Marília autoriza adesão a consórcio',
  );
});

test('resume ato oficial sem cortar frase e destaca pontos-chave', () => {
  const message = formatWhatsAppMessage({
    kind: 'gazette',
    title: 'Diário Oficial de Campo Belo (MG)',
    summary:
      'LEI Nº 4.497, DE 11 DE AGOSTO DE 2026. Dispõe sobre a autorização para a retirada do Município de Campo Belo do Consórcio Intermunicipal de Saúde – CISMARG. O Município permanece responsável pelas obrigações pecuniárias até a formalização do desligamento. O Poder Executivo deverá assegurar a continuidade da assistência à saúde.',
    rawText: '',
    source: 'Querido Diário',
    publishedAt: '2026-08-11T12:00:00-03:00',
    url: 'https://exemplo.gov.br/ato.pdf',
    territoryName: 'Campo Belo',
    stateCode: 'MG',
    classification: { category: 'SAÍDA', emoji: '🟧' },
  });
  assert.match(message, /\*Campo Belo autoriza saída do CISMARG\*/);
  assert.match(message, /> A Lei nº 4\.497\/2026 autoriza Campo Belo a se retirar do CISMARG\./);
  assert.match(message, /\*Pontos-chave\*/);
  assert.match(message, /- A saída ainda depende da formalização do desligamento\./);
  assert.match(message, /- As obrigações assumidas permanecem até a saída ser efetivada\./);
  assert.match(message, /- A continuidade da assistência à saúde deverá ser assegurada\./);
  assert.doesNotMatch(message, /…/);
});

test('extrai sigla entre parênteses sem capturar palavras do anexo', () => {
  const message = formatWhatsAppMessage({
    kind: 'gazette',
    title: 'Diário Oficial de Itápolis (SP)',
    summary:
      'Ratificação do protocolo de intenções do Consórcio Nacional para Gestão Climática e Prevenção de Desastres (Conclima), para participação do Município. CONS. FEIRA.',
    source: 'Querido Diário',
    publishedAt: '2026-08-12T12:00:00-03:00',
    url: 'https://exemplo.gov.br/ato.pdf',
    territoryName: 'Itápolis',
    classification: { category: 'ADESÃO', emoji: '🟦' },
  });
  assert.match(message, /Itápolis autoriza adesão ao CONCLIMA/);
  assert.doesNotMatch(message, /FEIRA/);
});

test('atuação em diário mostra a frase do fato e nunca autenticação do PDF', () => {
  const item = {
    kind: 'gazette', title: 'Diário Oficial de Mogi Guaçu (SP)', territoryName: 'Mogi Guaçu',
    source: 'Querido Diário', publishedAt: '2026-10-09T12:00:00-03:00', url: 'https://exemplo.gov.br/ato.pdf',
    summary: 'Diário Oficial assinado digitalmente conforme MP nº 2.200-2, garantindo autenticidade, validade jurídica e integridade. A partir de maio de 2026, observa-se uma mudança no modelo de gestão, com a execução direta do serviço pelo CREAS, por meio do Consórcio Intermunicipal CEMMIL, mantendo o cofinanciamento estadual.',
    classification: { category: 'ATUAÇÃO', emoji: '📰', evidenceText: 'A partir de maio de 2026, observa-se uma mudança no modelo de gestão, com a execução direta do serviço pelo CREAS, por meio do Consórcio Intermunicipal CEMMIL, mantendo o cofinanciamento estadual.' },
  };
  const message = formatWhatsAppMessage(item);
  assert.match(message, /execução direta do serviço pelo CREAS/);
  assert.doesNotMatch(message, /assinado digitalmente|autenticidade/);
  const noEvidence = formatWhatsAppMessage({ ...item, summary: 'Diário Oficial assinado digitalmente conforme MP nº 2.200-2, garantindo autenticidade, validade jurídica e integridade.', classification: { category: 'ATUAÇÃO', emoji: '📰' } });
  assert.doesNotMatch(noEvidence, /^> /m);
});
