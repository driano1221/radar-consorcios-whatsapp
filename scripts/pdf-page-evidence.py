"""Localiza menções em PDFs por página/coluna e sinaliza OCR só para páginas digitalizadas.

Uso: python scripts/pdf-page-evidence.py arquivo.pdf [--ocr]
Sem --ocr, nenhuma página é modificada. A saída é JSON para auditoria, não
constitui confirmação automática de criação, adesão ou outro evento.
"""

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


TERM = re.compile(r"\bcons[oó]rci[oa]s?\b", re.IGNORECASE)
MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES = 300


def normalize(text):
    compact = re.sub(r"\s+", " ", text or "").strip()
    compact = re.sub(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", "[CPF omitido]", compact)
    compact = re.sub(r"\b\d{11}\b", "[identificador omitido]", compact)
    return re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email omitido]", compact)


def needs_ocr(page, text):
    if len(normalize(text)) >= 30:
        return False
    area = float(page.width * page.height) or 1.0
    return any(
        abs(float(image.get("x1", 0)) - float(image.get("x0", 0)))
        * abs(float(image.get("bottom", 0)) - float(image.get("top", 0))) / area >= 0.55
        for image in page.images
    )


def page_regions(page):
    """Se há duas colunas bem separadas, evita concatenar linhas de atos distintos."""
    words = page.extract_words() or []
    if len(words) < 35:
        return [("página inteira", page)]
    midpoint = page.width / 2
    left = [word for word in words if float(word["x1"]) <= midpoint - 8]
    right = [word for word in words if float(word["x0"]) >= midpoint + 8]
    gutter = [word for word in words if float(word["x0"]) < midpoint + 8 and float(word["x1"]) > midpoint - 8]
    if len(left) >= 25 and len(right) >= 25 and len(gutter) <= len(words) * 0.13:
        return [
            ("esquerda", page.crop((0, 0, midpoint, page.height))),
            ("direita", page.crop((midpoint, 0, page.width, page.height))),
        ]
    return [("página inteira", page)]


def inspect_pdf(path, large=False):
    max_bytes = 50 * 1024 * 1024 if large else MAX_BYTES
    max_pages = 500 if large else MAX_PAGES
    if path.stat().st_size > max_bytes:
        raise ValueError(f"PDF acima do limite de {max_bytes // (1024 * 1024)} MiB")
    reader = PdfReader(path, strict=False)
    if len(reader.pages) > max_pages:
        raise ValueError(f"PDF acima do limite de {max_pages} páginas")
    findings = []
    ocr_pages = []
    with pdfplumber.open(path) as document:
        for index, (page, original) in enumerate(zip(document.pages, reader.pages), 1):
            pypdf_text = original.extract_text() or ""
            if needs_ocr(page, pypdf_text):
                ocr_pages.append(index)
                continue
            page_snippets = 0
            for column, region in page_regions(page):
                text = normalize(region.extract_text() or "")
                for match in TERM.finditer(text):
                    snippet = text[max(0, match.start() - 100):match.end() + 230].strip()
                    if snippet and not any(row["pagina"] == index and row["texto"] == snippet for row in findings):
                        findings.append({"pagina": index, "coluna": column, "texto": snippet})
                        page_snippets += 1
                    if page_snippets >= 8:
                        break
                if page_snippets >= 8:
                    break
    return {"paginas": len(reader.pages), "trechos": findings, "paginas_ocr_pendente": ocr_pages}


def run_ocr(path, large=False):
    executable = shutil.which("ocrmypdf")
    if not executable:
        raise RuntimeError("OCRmyPDF não está instalado; documento preservado sem alteração")
    with tempfile.TemporaryDirectory(prefix="radar-pdf-ocr-") as directory:
        output = Path(directory) / "ocr.pdf"
        subprocess.run([executable, "--skip-text", "--language", "por", "--output-type", "pdf",
                        str(path), str(output)], check=True, timeout=240)
        return inspect_pdf(output, large=large)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--ocr", action="store_true", help="Rodar OCRmyPDF somente se houver páginas sem texto")
    parser.add_argument("--large", action="store_true", help="Permitir até 50 MiB e 500 páginas em auditoria local")
    args = parser.parse_args()
    result = inspect_pdf(args.pdf, large=args.large)
    if args.ocr and result["paginas_ocr_pendente"]:
        result = run_ocr(args.pdf, large=args.large)
        result["ocr_aplicado"] = True
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
