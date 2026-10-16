"""Small shared predicates, independently testable without network or OCR."""
import re


def redact(text):
    text = re.sub(r"\b\d{3}\s*\.\s*\d{3}\s*\.\s*\d{3}\s*-\s*\d{2}\b", "[CPF omitido]", text or "")
    text = re.sub(r"\b\d{11}\b", "[identificador omitido]", text)
    return re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email omitido]", text).strip()


def image_page(page, text):
    if len(text.strip()) >= 80:
        return False
    area = float(page.width * page.height) or 1
    return any(abs(float(i.get("x1", 0)) - float(i.get("x0", 0))) *
               abs(float(i.get("bottom", 0)) - float(i.get("top", 0))) / area >= .55
               for i in page.images)
