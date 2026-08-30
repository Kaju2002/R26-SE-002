import re
import numpy as np
import torch
import torch.nn.functional as F

try:
    from lime.lime_text import LimeTextExplainer
except ImportError:  # pragma: no cover
    LimeTextExplainer = None

try:
    import shap
except ImportError:  # pragma: no cover
    shap = None

# Keep in sync with main.TEMPERATURE so LIME/SHAP explain the calibrated scores.
TEMPERATURE = 2.0
MAX_EXPLAIN_CHARS = 1800
LIME_SAMPLES = 40
LIME_FEATURES = 8
# Partition SHAP evaluations (2^6 + 1). Keeps /explain-text bounded.
SHAP_MAX_EVALS = 65
SHAP_HIGHLIGHT_LIMIT = 12
SPECIAL_TOKENS = {"<s>", "</s>", "<pad>", "<unk>", "<mask>", "[CLS]", "[SEP]", "[PAD]", "[UNK]"}
TOKEN_RE = re.compile(r"[A-Za-z0-9$€£+]{3,}")
STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "from", "your", "you",
    "are", "was", "were", "have", "has", "will", "our", "job", "jobs",
    "role", "team", "work", "working", "please", "their", "they", "who",
    "not", "but", "all", "any", "can", "may", "also", "into", "about",
}

_SHAP_EXPLAINERS = {}


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
    return highlights[:SHAP_HIGHLIGHT_LIMIT]


def _predict_proba_factory(tokenizer, model):
    def predict_proba(texts):
        if texts is None:
            return np.zeros((0, 2), dtype=np.float32)
        if hasattr(texts, "tolist"):
            texts = texts.tolist()
        if isinstance(texts, str):
            texts = [texts]
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
            probs = F.softmax(logits / TEMPERATURE, dim=-1).cpu().numpy()
        return probs.astype(np.float32)

    return predict_proba


def _is_new_word(piece):
    if piece.startswith("##"):
        return False
    if piece.startswith("▁") or piece.startswith("Ġ") or piece.startswith(" "):
        return True
    # Regex Text masker emits whole words with a trailing space.
    if " " in piece or "\n" in piece:
        return True
    return False


def merge_subword_attributions(tokens, values):
    """Collapse SentencePiece / BPE pieces into words and sum SHAP values."""
    words = []
    weights = []
    force_new = True
    prev_ended_word = True
    for token, value in zip(tokens, values):
        piece = str(token)
        if piece in SPECIAL_TOKENS:
            force_new = True
            prev_ended_word = True
            continue
        is_new = _is_new_word(piece) or force_new or prev_ended_word
        clean = piece.replace("▁", "").replace("Ġ", "").replace("##", "").strip()
        if not clean:
            continue
        if not TOKEN_RE.fullmatch(clean):
            force_new = True
            prev_ended_word = True
            continue
        force_new = False
        prev_ended_word = piece.endswith((" ", "\n", "\t"))
        weight = float(value)
        if is_new or not words:
            words.append(clean)
            weights.append(weight)
        else:
            words[-1] += clean
            weights[-1] += weight

    pairs = []
    seen = set()
    for word, weight in zip(words, weights):
        key = word.lower()
        if key in STOPWORDS or key in seen:
            continue
        seen.add(key)
        pairs.append((word, weight))
    return pairs


def _as_1d_fake_values(values):
    arr = np.asarray(values, dtype=np.float64)
    if arr.size == 0:
        return np.zeros((0,), dtype=np.float64)
    if arr.ndim == 1:
        return arr
    # (tokens, classes) — class 1 is fake
    if arr.ndim == 2:
        return arr[:, 1] if arr.shape[1] >= 2 else arr[:, 0]
    # (1, tokens, classes) or similar
    squeezed = np.squeeze(arr)
    if squeezed.ndim == 1:
        return squeezed
    if squeezed.ndim == 2:
        return squeezed[:, 1] if squeezed.shape[1] >= 2 else squeezed[:, 0]
    return np.ravel(squeezed)


def _shap_token_value_pairs(explanation):
    sample = explanation[0] if hasattr(explanation, "__len__") and len(explanation) else explanation
    tokens = sample.data
    values = sample.values
    if hasattr(tokens, "tolist"):
        tokens = tokens.tolist()
    if isinstance(tokens, str):
        tokens = [tokens]
    tokens = [str(token) for token in list(tokens)]
    fake_values = _as_1d_fake_values(values)
    count = min(len(tokens), len(fake_values))
    return tokens[:count], fake_values[:count]


def _get_shap_explainer(tokenizer, model):
    cache_key = id(model)
    cached = _SHAP_EXPLAINERS.get(cache_key)
    if cached is not None:
        return cached

    predict_proba = _predict_proba_factory(tokenizer, model)
    try:
        masker = shap.maskers.Text(tokenizer)
    except Exception:
        masker = shap.maskers.Text(r"\W+")
    explainer = shap.Explainer(
        predict_proba,
        masker,
        output_names=["legitimate", "fake"],
    )
    _SHAP_EXPLAINERS[cache_key] = explainer
    return explainer


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
    """Partition SHAP (shap library) attributions toward the fake class."""
    if shap is None:
        return []
    clipped = str(text or "").strip()[:MAX_EXPLAIN_CHARS]
    if len(clipped) < 15:
        return []

    try:
        explainer = _get_shap_explainer(tokenizer, model)
        explanation = explainer([clipped], max_evals=SHAP_MAX_EVALS)
        tokens, values = _shap_token_value_pairs(explanation)
        pairs = merge_subword_attributions(tokens, values)
        return _to_highlights(pairs)
    except Exception:
        return []


def explain_text(text, tokenizer, model):
    clipped = str(text or "").strip()
    lime = explain_with_lime(clipped, tokenizer, model)
    shap_values = explain_with_shap(clipped, tokenizer, model)
    return {"lime": lime, "shap": shap_values}
