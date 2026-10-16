"""Read a public PDF without rewriting it; return complete text by page.

OCR only for image-dominated pages with little text. Incomplete extraction is
explicit, never advertised as a complete reading. Input is a bounded local file.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import pdfplumber
from pypdf import PdfReader
from pdf_page_helpers import redact, image_page


def extract(path, ocr=False, max_ocr=20):
    if path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError("PDF acima de 20 MiB")
    reader = PdfReader(path, strict=False)
    if reader.is_encrypted:
        raise ValueError("PDF criptografado")
    if len(reader.pages) > 80:
        raise ValueError("PDF acima de 80 páginas; requer recuperação dedicada")
    pages = []
    ocr_count = 0
    with pdfplumber.open(path) as document, tempfile.TemporaryDirectory(prefix="radar-ocr-") as temporary:
        for number, (page, raw) in enumerate(zip(document.pages, reader.pages), 1):
            text = raw.extract_text() or ""
            scanned = image_page(page, text)
            method, status = "pypdf", "texto"
            if scanned:
                status = "ocr_pendente"
                if ocr and ocr_count < max_ocr and shutil.which("pdftoppm") and shutil.which("tesseract"):
                    ocr_count += 1
                    prefix = str(Path(temporary) / f"page-{number}")
                    try:
                        subprocess.run(["pdftoppm", "-f", str(number), "-l", str(number), "-r", "160",
                                        "-singlefile", "-png", str(path), prefix], check=True, timeout=20,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                        result = subprocess.run(["tesseract", prefix + ".png", "stdout", "-l", "por"],
                                                check=True, timeout=25, capture_output=True, text=True,
                                                encoding="utf-8")
                        text = result.stdout
                        method = "tesseract_por"
                        status = "texto_ocr" if len(text.strip()) >= 80 else "ocr_insuficiente"
                    except (subprocess.SubprocessError, OSError):
                        status = "ocr_falhou"
            elif len(text.strip()) < 30:
                # Blank pages and vector-only scans cannot be safely distinguished.
                status = "pagina_sem_texto"
            pages.append({"pagina": number, "leitor": method, "situacao": status, "texto": redact(text)})
    pending = [p["pagina"] for p in pages if p["situacao"] not in ("texto", "texto_ocr")]
    return {"pdf_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "paginas": pages,
            "paginas_pendentes": pending, "completo": bool(pages) and not pending,
            "ocr_paginas": ocr_count}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--ocr", action="store_true")
    args = parser.parse_args()
    print(json.dumps(extract(args.pdf, ocr=args.ocr), ensure_ascii=False))
