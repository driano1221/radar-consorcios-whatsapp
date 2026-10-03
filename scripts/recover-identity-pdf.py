"""One-off evidence recovery from public Querido Diário PDFs.

Reads the pending-identity queue and writes short, page-attributed snippets only.
It does not classify events, assert memberships, or modify the source catalog.
"""

import csv
import io
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from pypdf import PdfReader
from pypdf.errors import PdfReadError


ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data" / "catalogo" / "identidade-pendente.csv"
OUTPUT = ROOT / "data" / "catalogo" / "recuperacao-pdf.ndjson"
MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES = 300
MAX_SNIPPETS = 25
TERM = re.compile(r"\bcons[oó]rci[oa]s?\b", re.IGNORECASE)
CPF = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")


def clean(value):
    value = re.sub(r"\s+", " ", value).strip()
    return EMAIL.sub("[email omitido]", CPF.sub("[CPF omitido]", value))


def snippets_from_pdf(content):
    reader = PdfReader(io.BytesIO(content), strict=False)
    found = []
    for page_number, page in enumerate(reader.pages[:MAX_PAGES], 1):
        text = clean(page.extract_text() or "")
        for match in TERM.finditer(text):
            excerpt = clean(text[max(0, match.start() - 100):match.end() + 230])
            if excerpt and not any(item["texto"] == excerpt for item in found):
                found.append({"pagina": page_number, "texto": excerpt})
            if len(found) >= MAX_SNIPPETS:
                return len(reader.pages), found
    return len(reader.pages), found


def fetch_pdf(url):
    request = urllib.request.Request(url, headers={
        "User-Agent": "RadarConsorciosIPEA/0.3 (academic research; identity audit)",
        "Accept": "application/pdf",
    })
    with urllib.request.urlopen(request, timeout=35) as response:
        content_length = int(response.headers.get("Content-Length") or 0)
        if content_length > MAX_BYTES:
            raise ValueError("PDF acima do limite de 25 MiB")
        content = response.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise ValueError("PDF acima do limite de 25 MiB")
    if not content.startswith(b"%PDF-"):
        raise ValueError("resposta não é PDF")
    return content


def recover(row):
    result = {"documento_id": row["documento_id"], "url": row["url"],
              "situacao": "", "paginas": 0, "trechos": []}
    for attempt in range(2):
        try:
            content = fetch_pdf(row["url"])
            result["paginas"], result["trechos"] = snippets_from_pdf(content)
            result["situacao"] = "texto recuperado" if result["trechos"] else "sem menção textual"
            return result
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, PdfReadError) as error:
            if attempt == 1:
                result["situacao"] = f"falha: {type(error).__name__}: {str(error)[:130]}"
                return result
            time.sleep(3)
    return result


def main():
    with QUEUE.open(encoding="utf-8", newline="") as stream:
        pending = [row for row in csv.DictReader(stream)
                   if row["motivo"] == "sem trecho preservado"
                   and urlparse(row["url"]).hostname == "data.queridodiario.ok.org.br"
                   and row["url"].lower().endswith(".pdf")]
    results = []
    for index, row in enumerate(pending, 1):
        result = recover(row)
        results.append(result)
        print(f"[{index}/{len(pending)}] {row['documento_id'][:12]}: {result['situacao']}; "
              f"{len(result['trechos'])} trechos", flush=True)
        time.sleep(1.1)  # well below the publisher's documented request-rate reference
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in results) + "\n",
                      encoding="utf-8")
    print(f"Resultado: {OUTPUT}; documentos: {len(results)}", flush=True)


if __name__ == "__main__":
    main()
