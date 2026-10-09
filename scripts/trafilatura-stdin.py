"""Extrai texto de HTML recebido pela entrada padrão para o piloto comparativo."""

import sys

import trafilatura


html = sys.stdin.read()
text = trafilatura.extract(
    html,
    include_comments=False,
    include_tables=True,
    no_fallback=False,
)
sys.stdout.write(text or "")
