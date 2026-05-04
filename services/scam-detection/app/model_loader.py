# app/model_loader.py

import os
import torch
import torch.nn as nn
from transformers import (
    DistilBertTokenizer,
    DistilBertModel,
    DistilBertConfig,
    DistilBertForSequenceClassification,
)
from dotenv import load_dotenv

load_dotenv()

# ─── CONFIG ──────────────────────────────────────────────────────

MODEL_PATH   = os.getenv("MODEL_PATH",  "./models/phase2_distilbert")
PHASE1_PATH  = os.getenv("PHASE1_PATH", "./models/phase1_distilbert")

TACTIC_LABELS = ["urgency", "fomo", "sunk_cost", "social_proof"]
NUM_TACTICS   = len(TACTIC_LABELS)
DEVICE        = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_NESTED_REL = ("content", "phase2_distilbert")

# ── Phase 2 globals ───────────────────────────────────────────────
tokenizer    = None
model        = None
model_loaded = False

# ── Phase 1 globals (two-stage gate) ─────────────────────────────
p1_tokenizer    = None
p1_model        = None
p1_model_loaded = False


# ─── PHASE 2 ARCHITECTURE ────────────────────────────────────────

class TacticClassifier(nn.Module):
    def __init__(self, base_model, num_tactics, dropout=0.3):
        super().__init__()
        self.bert       = base_model
        hidden          = base_model.config.hidden_size
        self.dropout    = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden, num_tactics)

    def forward(self, input_ids, attention_mask):
        out = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True,
        )
        cls        = out.last_hidden_state[:, 0, :]
        logits     = self.classifier(self.dropout(cls))
        attentions = out.attentions
        return logits, attentions


# ─── HELPERS ─────────────────────────────────────────────────────

def _normalize_state_dict_keys(state: dict) -> dict:
    if not isinstance(state, dict):
        return state
    out = {}
    for k, v in state.items():
        nk = k
        for prefix in ("module.", "model."):
            if nk.startswith(prefix):
                nk = nk[len(prefix):]
                break
        out[nk] = v
    return out


def _resolve_asset_dir(root: str) -> str:
    root = os.path.abspath(os.path.normpath(root))
    if not os.path.isdir(root):
        return root

    candidates = [root]
    nested = os.path.join(root, *_NESTED_REL)
    if os.path.isdir(nested):
        candidates.append(nested)

    seen = set()

    def consider(path):
        path = os.path.abspath(path)
        if path in seen or not os.path.isdir(path):
            return
        seen.add(path)
        if os.path.isfile(os.path.join(path, "config.json")):
            candidates.append(path)

    for dirpath, dirnames, filenames in os.walk(root):
        depth = dirpath[len(root):].count(os.sep)
        if depth > 4:
            dirnames.clear()
            continue
        if "config.json" in filenames:
            consider(dirpath)

    def has_weights(d):
        return (os.path.isfile(os.path.join(d, "model_state.pt"))
                or os.path.isfile(os.path.join(d, "tactic_head.pt")))

    for d in candidates:
        if has_weights(d) and os.path.isfile(os.path.join(d, "config.json")):
            return d
    for d in candidates:
        if os.path.isfile(os.path.join(d, "config.json")):
            return d
    return root


def _torch_load(path: str):
    try:
        return torch.load(path, map_location=DEVICE, weights_only=False)
    except TypeError:
        return torch.load(path, map_location=DEVICE)


# ─── LOAD PHASE 2 MODEL ──────────────────────────────────────────

def load_model():
    """Load Phase 2 tactic classifier. Called once on startup."""
    global tokenizer, model, model_loaded

    try:
        print(f"[Phase 2] Loading model from {MODEL_PATH}...")
        asset_dir = _resolve_asset_dir(MODEL_PATH)
        if asset_dir != os.path.abspath(os.path.normpath(MODEL_PATH)):
            print(f"  Using asset directory: {asset_dir}")

        tokenizer = DistilBertTokenizer.from_pretrained(asset_dir)
        print("  Tokenizer loaded")

        config = DistilBertConfig.from_pretrained(asset_dir)
        if hasattr(config, "attn_implementation"):
            config.attn_implementation = "eager"
        base = DistilBertModel(config)
        print("  DistilBERT backbone built (attn_implementation=eager)")

        model = TacticClassifier(base, NUM_TACTICS, dropout=0.3)

        model_state_path = os.path.join(asset_dir, "model_state.pt")
        tactic_head_path = os.path.join(asset_dir, "tactic_head.pt")
        weights_ready = False

        if os.path.isfile(model_state_path):
            state = _torch_load(model_state_path)
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            if not isinstance(state, dict):
                raise ValueError("model_state.pt must contain a state_dict")
            state = _normalize_state_dict_keys(state)
            missing, unexpected = model.load_state_dict(state, strict=False)
            if missing:
                print(f"  (partial load) missing keys: {len(missing)}")
            if unexpected:
                print(f"  (partial load) unexpected keys: {len(unexpected)}")
            total_keys    = len(list(model.state_dict().keys()))
            weights_ready = len(missing) <= max(2, int(total_keys * 0.08))
            if weights_ready:
                print("  model_state.pt applied [OK]")
            else:
                print("  Warning: many keys missing — check Colab save format")
        elif os.path.isfile(tactic_head_path):
            checkpoint = _torch_load(tactic_head_path)
            if "classifier_state" in checkpoint:
                model.classifier.load_state_dict(checkpoint["classifier_state"])
            else:
                model.classifier.load_state_dict(checkpoint)
            print("  tactic_head.pt applied (backbone still random)")
            weights_ready = False
        else:
            print(f"  ERROR: model_state.pt and tactic_head.pt not found in {asset_dir}")

        model.to(DEVICE)
        model.eval()

        bert = getattr(model, "bert", None)
        if bert is not None and hasattr(bert, "set_attn_implementation"):
            bert.set_attn_implementation("eager")

        model_loaded = weights_ready
        print(f"  Phase 2 {'ready [OK]' if model_loaded else 'NOT ready [FAIL]'} on {DEVICE}")
        return True

    except Exception as e:
        print(f"[Phase 2] Load failed: {e}")
        model_loaded = False
        return False


# ─── LOAD PHASE 1 MODEL (two-stage gate) ─────────────────────────

def load_phase1_model():
    """
    Load Phase 1 binary scam classifier for the two-stage gate.
    Called once on startup after load_model().

    Phase 1 was saved as DistilBertForSequenceClassification
    with 2 labels: 0=legit, 1=scam

    If Phase 1 folder not found → system falls back to Phase 2 only.
    """
    global p1_tokenizer, p1_model, p1_model_loaded

    phase1_root = os.path.abspath(os.path.normpath(PHASE1_PATH))

    if not os.path.isdir(phase1_root):
        print(f"[Phase 1 Gate] Directory not found: {phase1_root}")
        print("  [WARN] Running without Phase 1 gate - Phase 2 only")
        p1_model_loaded = False
        return False

    try:
        # Phase 1 is often exported under:
        #   <PHASE1_PATH>/content/phase1_distilbert
        # so resolve to the first directory that actually contains HF weights.
        phase1_dir = phase1_root
        preferred = os.path.join(phase1_root, "content", "phase1_distilbert")
        candidates = [preferred, phase1_root]

        for dirpath, _, filenames in os.walk(phase1_root):
            if "config.json" in filenames:
                candidates.append(dirpath)

        seen = set()
        for c in candidates:
            c = os.path.abspath(c)
            if c in seen or not os.path.isdir(c):
                continue
            seen.add(c)
            has_config = os.path.isfile(os.path.join(c, "config.json"))
            has_hf_weights = (
                os.path.isfile(os.path.join(c, "model.safetensors"))
                or os.path.isfile(os.path.join(c, "pytorch_model.bin"))
            )
            if has_config and has_hf_weights:
                phase1_dir = c
                break

        print(f"[Phase 1 Gate] Loading from {phase1_dir}...")

        p1_tokenizer = DistilBertTokenizer.from_pretrained(
            phase1_dir, local_files_only=True
        )
        p1_model = DistilBertForSequenceClassification.from_pretrained(
            phase1_dir, local_files_only=True
        )
        p1_model.to(DEVICE)
        p1_model.eval()

        p1_model_loaded = True
        print(f"  Phase 1 gate ready [OK] on {DEVICE}")
        return True

    except Exception as e:
        print(f"[Phase 1 Gate] Load failed: {e}")
        print("  [WARN] Running without Phase 1 gate - Phase 2 only")
        p1_model_loaded = False
        return False


# ─── GETTERS ─────────────────────────────────────────────────────

def get_model():            return model
def get_tokenizer():        return tokenizer
def is_model_loaded():      return model_loaded
def get_device():           return DEVICE
def get_tactic_labels():    return TACTIC_LABELS
def get_phase1_model():     return p1_model
def get_phase1_tokenizer(): return p1_tokenizer
def is_phase1_loaded():     return p1_model_loaded