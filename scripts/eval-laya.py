"""Teste local e pontual do Laya; não integra os disparos do radar.

Requer ambiente isolado com `pip install laya==0.3.6` e checkpoint multilíngue.
Execute `node scripts/eval-ai.mjs` antes deste arquivo.
"""

import json
from pathlib import Path

import laya


ROOT = Path(__file__).resolve().parents[1]
dataset = json.loads((ROOT / "output/ai-eval-dataset.json").read_text(encoding="utf-8"))
model = laya.load("convaiinnovations/laya", subfolder="multilingual")
questions = {
    "relevant": {
        "type": "noul",
        "instructions": "O texto comprova um fato atual e específico sobre consórcio público intermunicipal, além de mera menção contábil, orçamentária ou normativa?",
    },
    "creation": {
        "type": "noul",
        "instructions": "O texto afirma a constituição de uma nova entidade de consórcio público intermunicipal? Criar agenda, projeto ou serviço por consórcio existente NÃO é criar um novo consórcio.",
    },
}
results = []
for item in dataset:
    state = {
        "titulo": item["title"],
        "resumo": item["summary"][:700],
        "trecho": item["evidence"][:1400],
        "fonte": item["source"],
    }
    answers = model.predict(state, questions)["answers"]
    relevant = answers["relevant"]["noul"] >= 0.5
    creation = answers["creation"]["noul"] >= 0.5
    result = {
        "id": item["id"],
        "expected": {"relevant": item["relevant"], "creation": item["creation"]},
        "predicted": {"relevant": relevant, "creation": creation},
        "probabilities": {"relevant": answers["relevant"]["noul"], "creation": answers["creation"]["noul"]},
        "relevantCorrect": relevant == item["relevant"],
        "creationCorrect": creation == item["creation"],
    }
    results.append(result)
    print(f"{item['id']}: relevante={relevant}, novo={creation}; acertos={int(result['relevantCorrect'])}/{int(result['creationCorrect'])}", flush=True)

summary = {
    "model": "laya multilingual (0.3.6)",
    "sampleSize": len(results),
    "relevantCorrect": sum(r["relevantCorrect"] for r in results),
    "creationCorrect": sum(r["creationCorrect"] for r in results),
}
(ROOT / "output/ai-eval-laya.json").write_text(
    json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(summary, ensure_ascii=False), flush=True)
