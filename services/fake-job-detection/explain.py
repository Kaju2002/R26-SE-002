import re
import numpy as np
import torch
import torch.nn.functional as F

try:
    from lime.lime_text import LimeTextExplainer
except ImportError:  # pragma: no cover
    LimeTextExplainer = None

MAX_EXPLAIN_CHARS = 1800
LIME_SAMPLES = 40
LIME_FEATURES = 8
SHAP_TOKEN_LIMIT = 16
TOKEN_RE = re.compile(r"[A-Za-z0-9$€£+]{3,}")
STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "from", "your", "you",
    "are", "was", "were", "have", "has", "will", "our", "job", "jobs",
    "role", "team", "work", "working", "please", "their", "they", "who",
    "not", "but", "all", "any", "can", "may", "also", "into", "about",
}


def _to_highlights(pairs):
    highlights = []
    for token, weight in pairs:
        word = str(token or "").strip()
        if not word or not np.isfinite(weight):
            continue
        highlights.append(
            {
                "token": word[:80],
                "weight": round(float(weight), 4),
                "toward": "fake" if weight >= 0 else "legitimate",
            }
        )
    highlights.sort(key=lambda item: abs(item["weight"]), reverse=True)
    return highlights[:12]


def _predict_proba_factory(tokenizer, model):
    def predict_proba(texts):
        rows = [str(text or "")[:MAX_EXPLAIN_CHARS] for text in texts]
        if not rows:
            return np.zeros((0, 2), dtype=np.float32)

        inputs = tokenizer(
            rows,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True,
        )
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = F.softmax(logits, dim=-1).cpu().numpy()
        return probs.astype(np.float32)

    return predict_proba


def explain_with_lime(text, tokenizer, model):
    if LimeTextExplainer is None:
        return []
    clipped = str(text or "").strip()[:MAX_EXPLAIN_CHARS]
    if len(clipped) < 15:
        return []

    predict_proba = _predict_proba_factory(tokenizer, model)
    explainer = LimeTextExplainer(class_names=["legitimate", "fake"])
    try:
        explanation = explainer.explain_instance(
            clipped,
            predict_proba,
            labels=(1,),
            num_features=LIME_FEATURES,
            num_samples=LIME_SAMPLES,
        )
        return _to_highlights(explanation.as_list(label=1))
    except Exception:
        return []


def explain_with_shap(text, tokenizer, model):
    """Leave-one-out token attribution toward the fake class (SHAP-style)."""
    clipped = str(text or "").strip()[:MAX_EXPLAIN_CHARS]
    if len(clipped) < 15:
        return []

    tokens = []
    seen = set()
    for match in TOKEN_RE.findall(clipped):
        word = match.lower()
        if word in STOPWORDS or word in seen:
            continue
        seen.add(word)
        tokens.append(match)
        if len(tokens) >= SHAP_TOKEN_LIMIT:
            break

    if not tokens:
        return []

    predict_proba = _predict_proba_factory(tokenizer, model)
    baseline = float(predict_proba([clipped])[0][1])
    masked = []
    for token in tokens:
        pattern = re.compile(re.escape(token), re.IGNORECASE)
        masked.append(pattern.sub(" ", clipped, count=1))

    probs = predict_proba(masked)
    pairs = []
    for token, row in zip(tokens, probs):
        contribution = baseline - float(row[1])
        pairs.append((token, contribution))
    return _to_highlights(pairs)


def explain_text(text, tokenizer, model):
    clipped = str(text or "").strip()
    lime = explain_with_lime(clipped, tokenizer, model)
    shap_values = explain_with_shap(clipped, tokenizer, model)
    return {"lime": lime, "shap": shap_values}
