# app/predictor.py

import torch
import numpy as np
from app.model_loader import (
    get_model, get_tokenizer, get_device, get_tactic_labels
)

# ─── TACTIC METADATA ─────────────────────────────────────────────

TACTIC_META = {
    "urgency": {
        "name": "Urgency Pressure",
        "description": "Creates artificial time pressure to stop you thinking clearly",
        "warning": "Legitimate employers never impose same-day deadlines or payment cutoffs.",
    },
    "fomo": {
        "name": "FOMO",
        "description": "Implies other candidates will take your opportunity if you delay",
        "warning": "Real companies do not pressure candidates by mentioning other applicants.",
    },
    "sunk_cost": {
        "name": "Sunk-Cost Manipulation",
        "description": "References your past effort to make you feel you cannot back out",
        "warning": "Do not feel obligated to continue because of time or money already spent.",
    },
    "social_proof": {
        "name": "Social Proof Manipulation",
        "description": "Uses fake authority or endorsements to appear legitimate",
        "warning": "Always verify company credentials independently before proceeding.",
    },
}

TACTIC_THRESHOLD = 0.50  # score above this = tactic detected


# ─── WORD IMPORTANCE (attention-based) ───────────────────────────

def get_word_importance(input_ids, attentions, tokenizer, top_n=5):
    """
    Extract which words the model focused on using attention weights.
    Returns top N words with normalized importance scores.
    """
    if attentions is None or len(attentions) == 0:
        return []
    # Average attention across all heads in the last layer
    last_layer_attention = attentions[-1]          # shape: [1, heads, seq, seq]
    avg_attention = last_layer_attention.mean(dim=1)[0][0]  # CLS row attention

    tokens = tokenizer.convert_ids_to_tokens(input_ids[0])

    # Combine subword tokens (e.g. "##ing") into full words
    words = []
    current_word = ""
    current_score = 0.0

    for token, score in zip(tokens, avg_attention.tolist()):
        if token in ["[CLS]", "[SEP]", "[PAD]"]:
            continue
        if token.startswith("##"):
            current_word += token[2:]
            current_score = max(current_score, score)
        else:
            if current_word:
                words.append({"word": current_word, "score": current_score})
            current_word = token
            current_score = score

    if current_word:
        words.append({"word": current_word, "score": current_score})

    # Sort by importance
    words.sort(key=lambda x: x["score"], reverse=True)
    top_words = words[:top_n]

    # Normalize scores to 0-1
    if top_words:
        max_score = top_words[0]["score"]
        if max_score > 0:
            for w in top_words:
                w["score"] = round(w["score"] / max_score, 3)

    return top_words


# ─── BUILD EXPLANATION ───────────────────────────────────────────

def build_explanation(tactics_detected, top_words):
    """
    Build a plain English explanation sentence based on
    detected tactics and the top trigger words.
    """
    if not tactics_detected:
        return "No manipulation tactics were detected in this message."

    word_list = ", ".join([w["word"] for w in top_words[:3]])
    tactic_names = " and ".join(
        [TACTIC_META[t]["name"] for t in tactics_detected]
    )

    return (
        f"The words {word_list} triggered the {tactic_names} detection. "
        f"These patterns are commonly found in recruitment scam messages."
    )


def build_warning(tactics_detected):
    """Build a combined warning message from all detected tactics."""
    if not tactics_detected:
        return "This message appears safe. No manipulation tactics were detected."

    warnings = [TACTIC_META[t]["warning"] for t in tactics_detected]
    return " ".join(warnings)


# ─── MAIN PREDICTOR ──────────────────────────────────────────────

def predict(text: str) -> dict:
    """
    Run the full prediction pipeline on a text message.

    Returns a dict with:
      is_scam, confidence, label, tactics,
      word_importance, warning, what_gave_it_away
    """
    model = get_model()
    tokenizer = get_tokenizer()
    device = get_device()
    tactic_labels = get_tactic_labels()

    if model is None or tokenizer is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    # ── Tokenize ──────────────────────────────────────────────────
    inputs = tokenizer(
        text,
        truncation=True,
        padding="max_length",
        max_length=128,
        return_tensors="pt"
    )
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)

    # ── Inference ─────────────────────────────────────────────────
    with torch.no_grad():
        logits, attentions = model(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

    # ── Tactic scores (sigmoid for multi-label) ───────────────────
    tactic_probs = torch.sigmoid(logits)[0].cpu().numpy()

    # ── Binary scam detection ─────────────────────────────────────
    # If ANY tactic fires above threshold → scam
    max_tactic_score = float(np.max(tactic_probs))
    is_scam = max_tactic_score >= TACTIC_THRESHOLD

    # Confidence = max tactic probability if scam,
    # else 1 - max probability if legit
    if is_scam:
        confidence = int(round(max_tactic_score * 100))
    else:
        confidence = int(round((1 - max_tactic_score) * 100))

    # ── Detected tactics ──────────────────────────────────────────
    tactics_detected = []
    for label, score in zip(tactic_labels, tactic_probs):
        if score >= TACTIC_THRESHOLD:
            tactics_detected.append({
                "name": TACTIC_META[label]["name"],
                "key": label,
                "score": round(float(score), 3),
                "description": TACTIC_META[label]["description"],
            })

    # Sort by score descending
    tactics_detected.sort(key=lambda x: x["score"], reverse=True)

    # ── Word importance ───────────────────────────────────────────
    word_importance = get_word_importance(
        input_ids.cpu(), attentions, tokenizer, top_n=5
    )

    # ── Explanations ──────────────────────────────────────────────
    detected_keys = [t["key"] for t in tactics_detected]
    what_gave_it_away = build_explanation(detected_keys, word_importance)
    warning = build_warning(detected_keys)

    return {
        "is_scam": is_scam,
        "confidence": confidence,
        "label": "SCAM DETECTED" if is_scam else "LEGITIMATE",
        "tactics": tactics_detected,
        "word_importance": word_importance,
        "warning": warning,
        "what_gave_it_away": what_gave_it_away,
    }