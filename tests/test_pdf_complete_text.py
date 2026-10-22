import importlib.util
import sys
import unittest
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

scripts = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location('page_evidence', scripts / 'pdf-page-evidence.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Page:
    width = height = 100
    images = []
    chars = []

    def __init__(self, text):
        self.text = text

    def extract_text(self):
        return self.text

    def extract_words(self):
        return []


class CompleteTextTests(unittest.TestCase):
    def inspect(self, pages):
        source = SimpleNamespace(stat=lambda: SimpleNamespace(st_size=100))
        with patch.object(module, 'PdfReader', return_value=SimpleNamespace(pages=pages)), \
             patch.object(module.pdfplumber, 'open', return_value=nullcontext(SimpleNamespace(pages=pages))):
            return module.inspect_pdf(source, full_text=True)

    def test_all_pages_preserved_and_identifiers_redacted(self):
        result = self.inspect([Page('Consórcio municipal aprovou o ato. ' * 5), Page('CPF 123.456.789-10 nome@teste.br. ' * 5)])
        self.assertIn('[Página 1]', result['texto_integral'])
        self.assertIn('[Página 2]', result['texto_integral'])
        self.assertIn('[CPF omitido]', result['texto_integral'])
        self.assertNotIn('nome@teste.br', result['texto_integral'])

    def test_scanned_body_with_native_header_is_never_complete(self):
        page = Page('Cabeçalho do diário. ' * 10)
        page.images = [{'x0': 0, 'x1': 100, 'top': 20, 'bottom': 100}]
        page.chars = [{'x0': 0, 'x1': 99, 'top': 0, 'bottom': 10, 'text': page.text}]
        result = self.inspect([page])
        self.assertEqual(result['paginas_ocr_pendente'], [1])
        self.assertEqual(result['texto_integral'], '')


if __name__ == '__main__':
    unittest.main()
