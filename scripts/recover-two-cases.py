"""Read-only public-document audit; never imports the radar or touches its state."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/document-recovery-2026-10-16'
OUT.mkdir(parents=True, exist_ok=True)
TARGETS = ['1214381', '1210770', '1217068']

def curl(url):
    return subprocess.check_output(['curl.exe', '-f', '-sS', '--max-time', '45', url])

if __name__ == '__main__':
    home = (OUT / 'diario-home.html').read_text(encoding='utf-8')
    paths = sorted(set(re.findall(r'/Home/ViewDiario/[^\s\'\"]+\.pdf', home)))
    paths += ['/Home/ViewDiario/2026_09_30_Diario.pdf', '/Home/ViewDiario/2026_09_30_Diario_A.pdf']
    manifest = []
    for path in paths:
        url = 'https://doc.tce.mg.gov.br' + path
        dest = OUT / path.rsplit('/', 1)[-1]
        try:
            if not dest.exists():
                raw = curl(url)
                if not raw.startswith(b'%PDF-'):
                    raise ValueError('not PDF')
                dest.write_bytes(raw)
            pages = [p.extract_text() or '' for p in PdfReader(dest).pages]
            (dest.with_suffix('.pages.json')).write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
            matches = []
            for i, text in enumerate(pages, 1):
                for target in TARGETS:
                    for m in re.finditer(target, text):
                        matches.append({'process': target, 'page': i, 'context': text[max(0,m.start()-650):m.end()+1800]})
            manifest.append({'url': url, 'file': dest.name, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'pages': len(pages), 'matches': matches})
            print(json.dumps({'file': dest.name, 'matches': matches}, ensure_ascii=False), flush=True)
        except Exception as error:
            manifest.append({'url': url, 'error': str(error)})
            print(str(error), flush=True)
    (OUT / 'diary-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
