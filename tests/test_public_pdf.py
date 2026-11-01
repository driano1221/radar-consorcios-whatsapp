import sys
import unittest
import importlib.util
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from pdf_page_helpers import redact, image_page
from pypdf import PdfWriter


class DedicatedPdfLimitTests(unittest.TestCase):
    def test_large_mode_keeps_default_limit_and_does_not_claim_blank_pages_as_read(self):
        script = Path(__file__).resolve().parents[1] / "scripts" / "extract-public-pdf.py"
        spec = importlib.util.spec_from_file_location("public_pdf_reader", script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="radar-pdf-limit-") as directory:
            document = Path(directory) / "blank-pages.pdf"
            writer = PdfWriter()
            for _ in range(81):
                writer.add_blank_page(width=100, height=100)
            with document.open("wb") as output:
                writer.write(output)
            with self.assertRaisesRegex(ValueError, "80 páginas"):
                module.extract(document)
            result = module.extract(document, large=True)
            self.assertFalse(result["completo"])
            self.assertEqual(len(result["paginas_pendentes"]), 81)


class Page:
    width = 100
    height = 100
    images = [{"x0": 0, "x1": 100, "top": 0, "bottom": 100}]


class PdfTests(unittest.TestCase):
    def test_native_header_does_not_hide_scanned_body(self):
        page = Page()
        page.images = [{"x0": 0, "x1": 100, "top": 20, "bottom": 100}]
        page.chars = [{"x0": 0, "x1": 99, "top": 0, "bottom": 10, "text": "Cabeçalho " * 15}]
        self.assertTrue(image_page(page, "Cabeçalho " * 15))
        page.chars.append({"x0": 0, "x1": 99, "top": 25, "bottom": 80, "text": "Texto do corpo " * 15})
        self.assertFalse(image_page(page, "Texto nativo " * 30))

    def test_ocr_only_when_image_dominates_and_text_is_missing(self):
        self.assertTrue(image_page(Page(), ""))
        self.assertFalse(image_page(Page(), "Texto nativo " * 20))
        page = Page()
        page.images = [{"x0": 0, "x1": 10, "top": 0, "bottom": 10}]
        self.assertFalse(image_page(page, ""))

    def test_redacts_cpf_even_with_line_breaks_but_preserves_cnpj(self):
        result = redact("123 . 456 . 789 -\n10 nome@teste.br 12.345.678/0001-90")
        self.assertIn("[CPF omitido]", result)
        self.assertIn("[email omitido]", result)
        self.assertIn("12.345.678/0001-90", result)


if __name__ == "__main__":
    unittest.main()
