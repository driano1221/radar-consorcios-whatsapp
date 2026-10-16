"""Validate recovered primary sources, not a classifier or production importer.

No WhatsApp, AI, production writes or permissive process-number matching.
PDFs are downloaded from exact public links observed in SAPL / DOC annotations.
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/document-recovery-2026-10-16'
SAPL = 'https://sapl.divinopolis.mg.leg.br/media/sapl/public/'
SOURCES = [
    ('divinopolis-lei-9770.pdf', SAPL+'normajuridica/2026/22340/lei_no_9770-2026_-_extincao_do_consorcio_mullheres_das_gerais.pdf', 1,
     [(1, 'autorizado a subscrever a extinção'), (1, 'Fica revogada a Lei nº 9.013')]),
    ('divinopolis-publicacao.pdf', SAPL+'anexonormajuridica/2026/3921/extrato_-_lei_no_9.770_de_21_de_setembro_de_2026__diario_oficial_dos_municipios_mineiros.pdf', 2,
     [(1, '24/09/2026'), (1, '7F3C92D0')]),
    ('tce-1214381.pdf', 'https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4759754', 14,
     [(1, 'Processo: 1214381'), (2, 'Ata de Registro de Preços nº 041/2026'), (2, 'em referendar a decisão monocrática'), (2, 'ensejará a aplicação de multa pessoal')]),
    ('tce-1210770.pdf', 'https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4760666', 7,
     [(1, 'Processo: 1210770'), (2, 'declarar a extinção do processo, sem resolução de mérito'), (2, 'aplicar multa no valor de R$10.000,00'), (2, 'ao Sr. Frederico Ozanan Rangel'), (5, 'não comunicaram a revogação')]),
    ('tce-1217968.pdf', 'https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/4759190', 13,
     [(1, 'Processo: 1217968'), (1, 'Consórcio Regional de Saneamento Básico'), (2, 'Ata de Registro de Preços n. 4/2026'), (2, 'sob pena de multa diária')]),
]

def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()

def protected_hashes():
    result = {}
    for directory in ['src', 'config', 'data', 'state', 'dashboard/src', '.github/workflows']:
        for path in (ROOT/directory).rglob('*'):
            if path.is_file():
                result[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

def validate():
    before = protected_hashes()
    OUT.mkdir(parents=True, exist_ok=True)
    docs = []
    for filename, url, expected_count, assertions in SOURCES:
        path = OUT/filename
        if not path.exists():
            subprocess.run(['curl.exe', '-f', '-sS', '--max-time', '45', url, '-o', str(path)], check=True)
        raw = path.read_bytes()
        assert raw.startswith(b'%PDF-'), filename
        pages = [normalize(page.extract_text() or '') for page in PdfReader(path).pages]
        assert len(pages) == expected_count, filename
        for page, quote in assertions:
            assert normalize(quote) in pages[page-1], (filename, page, quote)
        docs.append({'file': filename, 'url': url, 'sha256': hashlib.sha256(raw).hexdigest(),
                     'page_count': len(pages), 'pages': pages,
                     'checked_quotes': [{'page': p, 'quote': q} for p,q in assertions]})
    # A near-matching number is not documentary confirmation of the news number.
    consane = docs[-1]['pages'][0]
    assert 'Processo: 1217068' not in consane
    assert 'Processo: 1217968' in consane
    # Distinct proceedings cannot collapse into one event despite the same date/entity.
    keys = ['tce-mg:1214381:2026-09-29:referendo', 'tce-mg:1210770:2026-09-29:acordao',
            'tce-mg:1217968:2026-09-29:referendo', 'divinopolis:lei:9770:2026']
    assert len(keys) == len(set(keys))
    after = protected_hashes()
    assert before == after, 'Protected production files changed'
    report = {'mode': 'documentary-validation-only', 'activated': False, 'whatsapp_sends': 0,
              'protected_files_checked': len(before), 'protected_files_unchanged': True,
              'quotes_checked': sum(len(x[3]) for x in SOURCES),
              'original_simulation_replaced': False, 'documents': docs,
              'proposed_event_keys_not_applied': keys,
              'news_process': '1217068', 'primary_process': '1217968',
              'association_status': 'manual proposal based on same session, rapporteur, acronym and outcome; not exact identifier match'}
    (OUT/'validated-evidence.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['documents']}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    validate()
