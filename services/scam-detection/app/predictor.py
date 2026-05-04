# app/predictor.py
# Ensemble approach: Phase 1 + Phase 2 ALWAYS run together.
#
# Decision logic:
#   Phase 2 is the PRIMARY authority on scam tactics.
#   Phase 1 provides additional signal for borderline LEGIT cases.
#
# Flow:
#   Step 1: Run Phase 1 (binary scam probability)
#   Step 2: Run Phase 2 (tactic classification) — ALWAYS
#   Step 3: Combine:
#     - Phase 2 found tactics → SCAM (Phase 2 wins)
#     - Phase 2 no tactics + Phase 1 < 0.40 → LEGIT (both agree)
#     - Phase 2 no tactics + Phase 1 > 0.40 → LEGIT (low confidence)
#
# Why both always run:
#   Phase 1 alone misses subtle earning scams ("$500/hr easy work")
#   Phase 2 alone over-flags ambiguous legit ("You have been selected")
#   Together they complement each other correctly.

import torch
import numpy as np
from app.model_loader import (
    get_model, get_tokenizer, get_device, get_tactic_labels,
    get_phase1_model, get_phase1_tokenizer, is_phase1_loaded,
)

# ─── TACTIC METADATA ─────────────────────────────────────────────

TACTIC_META = {
    "urgency": {
        "name":        "Urgency Pressure",
        "description": "Creates artificial time pressure to stop you thinking clearly",
        "warning":     "Legitimate employers never impose same-day deadlines or payment cutoffs.",
    },
    "fomo": {
        "name":        "FOMO",
        "description": "Implies other candidates will take your opportunity if you delay",
        "warning":     "Real companies do not pressure candidates by mentioning other applicants.",
    },
    "sunk_cost": {
        "name":        "Sunk-Cost Manipulation",
        "description": "References your past effort to make you feel you cannot back out",
        "warning":     "Do not feel obligated to continue because of time or money already spent.",
    },
    "social_proof": {
        "name":        "Social Proof Manipulation",
        "description": "Uses fake authority or endorsements to appear legitimate",
        "warning":     "Always verify company credentials independently before proceeding.",
    },
}

# ─── PER-TACTIC THRESHOLDS ───────────────────────────────────────
# From threshold tuning on validation set
TACTIC_THRESHOLDS = {
    "urgency":      0.50,
    "fomo":         0.30,
    "sunk_cost":    0.45,
    "social_proof": 0.40,
}

# ─── PHASE 1 CONFIDENCE THRESHOLDS ───────────────────────────────
# Used ONLY when Phase 2 finds no tactics
# to determine LEGIT confidence level
P1_CONFIDENT_LEGIT = 0.40   # below this = Phase 1 very confident LEGIT
P1_UNCERTAIN       = 0.65   # above this = Phase 1 leans SCAM but no tactics found


# ─── STEP 1: RUN PHASE 1 ─────────────────────────────────────────

def run_phase1(text: str) -> float | None:
    """
    Run Phase 1 binary classifier.
    Returns scam probability (0.0 to 1.0).
    Returns None if Phase 1 not loaded — system continues with Phase 2 only.
    """
    if not is_phase1_loaded():
        return None

    p1_tok   = get_phase1_tokenizer()
    p1_model = get_phase1_model()
    device   = get_device()

    inputs = p1_tok(
        text,
        truncation=True,
        padding="max_length",
        max_length=128,
        return_tensors="pt",
    )
    input_ids      = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)

    with torch.no_grad():
        outputs   = p1_model(input_ids=input_ids, attention_mask=attention_mask)
        probs     = torch.softmax(outputs.logits, dim=1)[0]
        scam_prob = float(probs[1].item())   # index 1 = SCAM

    return scam_prob


# ─── STEP 2: RUN PHASE 2 ─────────────────────────────────────────

def run_phase2(text: str) -> dict:
    """
    Run Phase 2 multi-label tactic classifier.
    Returns raw tactic scores and word importance.
    Always called — Phase 2 is the primary decision maker.
    """
    model         = get_model()
    tokenizer     = get_tokenizer()
    device        = get_device()
    tactic_labels = get_tactic_labels()

    if model is None or tokenizer is None:
        raise RuntimeError("Phase 2 model not loaded. Call load_model() first.")

    inputs = tokenizer(
        text,
        truncation=True,
        padding="max_length",
        max_length=128,
        return_tensors="pt",
    )
    input_ids      = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)

    with torch.no_grad():
        logits, attentions = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )

    tactic_probs = torch.sigmoid(logits)[0].cpu().numpy()

    # Detect tactics using per-tactic thresholds
    tactics_detected = []
    for label, score in zip(tactic_labels, tactic_probs):
        threshold = TACTIC_THRESHOLDS.get(label, 0.50)
        if score >= threshold:
            tactics_detected.append({
                "name":        TACTIC_META[label]["name"],
                "key":         label,
                "score":       round(float(score), 3),
                "description": TACTIC_META[label]["description"],
            })
    tactics_detected.sort(key=lambda x: x["score"], reverse=True)

    word_importance = get_word_importance(
        input_ids.cpu(), attentions, tokenizer, top_n=5
    )

    return {
        "tactics_detected": tactics_detected,
        "tactic_probs":     tactic_probs,
        "word_importance":  word_importance,
        "input_ids":        input_ids.cpu(),
    }


# ─── WORD IMPORTANCE ─────────────────────────────────────────────

def get_word_importance(input_ids, attentions, tokenizer, top_n=5):
    if attentions is None or len(attentions) == 0:
        return []

    last_layer = attentions[-1]
    avg_attn   = last_layer.mean(dim=1)[0][0]
    tokens     = tokenizer.convert_ids_to_tokens(input_ids[0])

    def _is_real_word(w):
        return bool(w) and any(ch.isalpha() for ch in w) and len(w) >= 2

    words     = []
    cur_word  = ""
    cur_score = 0.0

    for token, score in zip(tokens, avg_attn.tolist()):
        if token in ["[CLS]", "[SEP]", "[PAD]"]:
            continue
        if token.startswith("##"):
            cur_word  += token[2:]
            cur_score  = max(cur_score, score)
        else:
            if cur_word and _is_real_word(cur_word):
                words.append({"word": cur_word, "score": cur_score})
            cur_word, cur_score = token, score

    if cur_word and _is_real_word(cur_word):
        words.append({"word": cur_word, "score": cur_score})

    words.sort(key=lambda x: x["score"], reverse=True)
    top = words[:top_n]

    if top:
        mx = top[0]["score"]
        if mx > 0:
            for w in top:
                w["score"] = round(w["score"] / mx, 3)

    return top


# ─── EXPLANATIONS ────────────────────────────────────────────────

def build_explanation(tactics_detected, top_words):
    if not tactics_detected:
        return "No manipulation tactics were detected in this message."
    word_list    = ", ".join([w["word"] for w in top_words[:3]])
    tactic_names = " and ".join([TACTIC_META[t]["name"] for t in tactics_detected])
    return (
        f"The words {word_list} triggered the {tactic_names} detection. "
        f"These patterns are commonly found in recruitment scam messages."
    )


def build_warning(tactics_detected):
    if not tactics_detected:
        return "This message appears safe. No manipulation tactics were detected."
    return " ".join([TACTIC_META[t]["warning"] for t in tactics_detected])


# ─── STEP 3: COMBINE — FINAL DECISION ────────────────────────────

def combine(p1_prob: float | None, p2: dict) -> dict:
    """
    Combine Phase 1 and Phase 2 results into final prediction.

    Decision rules:
      Rule 1: Phase 2 found tactics → SCAM
              (Phase 2 wins — catches subtle earning scams)

      Rule 2: Phase 2 no tactics + Phase 1 < 0.40 → LEGIT (confident)
              (Both agree — catches false positives like "You are selected")

      Rule 3: Phase 2 no tactics + Phase 1 unavailable → LEGIT (Phase 2 only)

      Rule 4: Phase 2 no tactics + Phase 1 ≥ 0.40 → LEGIT (lower confidence)
              (Phase 2 found nothing, Phase 1 uncertain — trust Phase 2)
    """
    tactics_detected = p2["tactics_detected"]
    tactic_probs     = p2["tactic_probs"]
    word_importance  = p2["word_importance"]
    detected_keys    = [t["key"] for t in tactics_detected]

    what_gave_it_away = build_explanation(detected_keys, word_importance)
    warning           = build_warning(detected_keys)

    # ── Rule 1: Phase 2 found tactics → SCAM ─────────────────────
    if tactics_detected:
        max_tactic_score = max(t["score"] for t in tactics_detected)
        confidence = int(round(max_tactic_score * 100))

        return {
            "is_scam":          True,
            "confidence":       confidence,
            "label":            "SCAM DETECTED",
            "tactics":          tactics_detected,
            "word_importance":  word_importance,
            "warning":          warning,
            "what_gave_it_away": what_gave_it_away,
            "decision_stage":   "phase2_tactic",
            "phase1_prob":      round(p1_prob, 3) if p1_prob is not None else None,
        }

    # ── Phase 2 found NO tactics ──────────────────────────────────
    max_score = float(np.max(tactic_probs))

    # Rule 2: Phase 1 confident LEGIT
    if p1_prob is not None and p1_prob < P1_CONFIDENT_LEGIT:
        # Both Phase 1 (confident legit) and Phase 2 (no tactics) agree
        # High confidence LEGIT
        confidence = int(round(((1 - p1_prob) + (1 - max_score)) / 2 * 100))
        return {
            "is_scam":          False,
            "confidence":       min(confidence, 97),
            "label":            "LEGITIMATE",
            "tactics":          [],
            "word_importance":  word_importance,
            "warning":          warning,
            "what_gave_it_away": what_gave_it_away,
            "decision_stage":   "ensemble_legit",
            "phase1_prob":      round(p1_prob, 3),
        }

    # Rule 3 & 4: Phase 2 no tactics, Phase 1 unavailable or uncertain
    # Trust Phase 2 — return LEGIT with lower confidence
    if p1_prob is not None and p1_prob >= P1_UNCERTAIN:
        # Phase 1 leans scam but Phase 2 found nothing
        # Return LEGIT but with reduced confidence
        confidence = int(round((1 - max_score) * 70))   # reduced confidence
    else:
        confidence = int(round((1 - max_score) * 100))

    return {
        "is_scam":          False,
        "confidence":       confidence,
        "label":            "LEGITIMATE",
        "tactics":          [],
        "word_importance":  word_importance,
        "warning":          warning,
        "what_gave_it_away": what_gave_it_away,
        "decision_stage":   "phase2_no_tactics",
        "phase1_prob":      round(p1_prob, 3) if p1_prob is not None else None,
    }


# ─── MAIN PREDICT — ENSEMBLE ──────────────────────────────────────

def predict(text: str) -> dict:
    """
    Ensemble prediction pipeline.
    Both Phase 1 and Phase 2 ALWAYS run.
    Phase 2 is the primary authority on tactic detection.
    Phase 1 provides additional signal for LEGIT confidence.

    Example outcomes:
      "Earn $500/hr easy work"
        Phase 1: 0.35 (thinks legit)
        Phase 2: social_proof=0.72 (catches earning scam)
        → Rule 1: SCAM ✅ (Phase 2 wins)

      "Your resume has been shortlisted. HR will contact you."
        Phase 1: 0.18 (confident legit)
        Phase 2: no tactics detected
        → Rule 2: LEGIT (high confidence) ✅

      "Pay LKR 5000 before 5pm to confirm your slot"
        Phase 1: 0.88 (scam)
        Phase 2: urgency=0.83
        → Rule 1: SCAM ✅ (both agree)

      "You have been selected for the next round."
        Phase 1: 0.22 (legit)
        Phase 2: no tactics detected
        → Rule 2: LEGIT ✅ (false positive fixed)
    """

    # Step 1: Run Phase 1
    p1_prob = run_phase1(text)

    # Step 2: Run Phase 2 — ALWAYS
    p2 = run_phase2(text)

    # Step 3: Combine and return final decision
    return combine(p1_prob, p2)