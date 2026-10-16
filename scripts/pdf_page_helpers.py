"""Small shared predicates, independently testable without network or OCR."""
import re


def redact(text):
    text = re.sub(r"\b\d{3}\s*\.\s*\d{3}\s*\.\s*\d{3}\s*-\s*\d{2}\b", "[CPF omitido]", text or "")
    text = re.sub(r"\b\d{11}\b", "[identificador omitido]", text)
    return re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email omitido]", text).strip()


def image_page(page, text):
    area = float(page.width * page.height) or 1
    for image in page.images:
        x0, x1 = float(image.get("x0", 0)), float(image.get("x1", 0))
        top, bottom = float(image.get("top", 0)), float(image.get("bottom", 0))
        if abs(x1 - x0) * abs(bottom - top) / area < .55:
            continue
        if len(text.strip()) < 80:
            return True
        # A native header does not make a scanned body readable. Count text
        # over the large image, not the gazette header/footer outside it.
        chars = getattr(page, "chars", None)
        if chars is not None:
            inside = sum(len(c.get("text", "")) for c in chars
                         if x0 <= (c.get("x0", 0) + c.get("x1", 0)) / 2 <= x1
                         and top <= (c.get("top", 0) + c.get("bottom", 0)) / 2 <= bottom)
            if inside < 80:
                return True
    return False
