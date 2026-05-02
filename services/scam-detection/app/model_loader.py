# app/model_loader.py

import os
import torch
import torch.nn as nn
from transformers import DistilBertTokenizer, DistilBertModel, DistilBertConfig
from dotenv import load_dotenv

load_dotenv()

# ─── CONFIG ──────────────────────────────────────────────────────

MODEL_PATH = os.getenv("MODEL_PATH", "./models/phase2_distilbert")
TACTIC_LABELS = ["urgency", "fomo", "sunk_cost", "social_proof"]
NUM_TACTICS = len(TACTIC_LABELS)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Colab zips often unzip to: phase2_distilbert/content/phase2_distilbert/
_NESTED_REL = ("content", "phase2_distilbert")

# Global variables — loaded once, reused for every request
tokenizer = None
model = None
model_loaded = False


# ─── MODEL ARCHITECTURE ──────────────────────────────────────────
# Must match exactly what was used in Phase 2 training (script 06)

class TacticClassifier(nn.Module):
    def __init__(self, base_model, num_tactics, dropout=0.3):
        super().__init__()
        self.bert = base_model
        hidden = base_model.config.hidden_size
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden, num_tactics)

    def forward(self, input_ids, attention_mask):
        out = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True   # needed for word importance
        )
        cls = out.last_hidden_state[:, 0, :]
        logits = self.classifier(self.dropout(cls))
        attentions = out.attentions
        return logits, attentions


def _normalize_state_dict_keys(state: dict) -> dict:
    """Strip common Colab / DataParallel prefixes so keys match TacticClassifier."""
    if not isinstance(state, dict):
        return state
    out = {}
    for k, v in state.items():
        nk = k
        for prefix in ("module.", "model."):
            if nk.startswith(prefix):
                nk = nk[len(prefix) :]
                break
        out[nk] = v
    return out


def _resolve_asset_dir(root: str) -> str:
    """
    Pick the directory that contains HF config + tokenizer, preferring one that
    also has model_state.pt / tactic_head.pt (Colab nested layout supported).
    """
    root = os.path.abspath(os.path.normpath(root))
    if not os.path.isdir(root):
        return root

    candidates: list[str] = [root]
    nested = os.path.join(root, *_NESTED_REL)
    if os.path.isdir(nested):
        candidates.append(nested)

    seen = set()

    def consider(path: str) -> None:
        path = os.path.abspath(path)
        if path in seen or not os.path.isdir(path):
            return
        seen.add(path)
        if os.path.isfile(os.path.join(path, "config.json")):
            candidates.append(path)

    for dirpath, dirnames, filenames in os.walk(root):
        depth = dirpath[len(root) :].count(os.sep)
        if depth > 4:
            dirnames.clear()
            continue
        if "config.json" in filenames:
            consider(dirpath)

    def has_weights(d: str) -> bool:
        return os.path.isfile(os.path.join(d, "model_state.pt")) or os.path.isfile(
            os.path.join(d, "tactic_head.pt")
        )

    for d in candidates:
        if has_weights(d) and os.path.isfile(os.path.join(d, "config.json")):
            return d
    for d in candidates:
        if os.path.isfile(os.path.join(d, "config.json")):
            return d
    return root


# ─── LOAD MODEL ──────────────────────────────────────────────────

def load_model():
    """
    Loads tokenizer + DistilBERT model from disk.
    Called once on server startup.
    """
    global tokenizer, model, model_loaded

    try:
        print(f"Loading model from {MODEL_PATH}...")
        asset_dir = _resolve_asset_dir(MODEL_PATH)
        if asset_dir != os.path.abspath(os.path.normpath(MODEL_PATH)):
            print(f"  Using asset directory: {asset_dir}")

        # Load tokenizer (HF: tokenizer.json / vocab.txt in folder is enough)
        tokenizer = DistilBertTokenizer.from_pretrained(asset_dir)
        print("  Tokenizer loaded")

        # Backbone from config.json only — do NOT use from_pretrained(MODEL_PATH) for
        # weights; Colab exports use model_state.pt / tactic_head.pt, not
        # pytorch_model.bin / model.safetensors.
        config = DistilBertConfig.from_pretrained(asset_dir)
        base = DistilBertModel(config)
        print("  DistilBERT backbone built from config.json")

        # Rebuild TacticClassifier with same architecture as training
        model = TacticClassifier(base, NUM_TACTICS, dropout=0.3)

        tactic_head_path = os.path.join(asset_dir, "tactic_head.pt")
        model_state_path = os.path.join(asset_dir, "model_state.pt")
        weights_ready = False

        def _torch_load(path: str):
            try:
                return torch.load(path, map_location=DEVICE, weights_only=False)
            except TypeError:
                return torch.load(path, map_location=DEVICE)

        if os.path.isfile(model_state_path):
            state = _torch_load(model_state_path)
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            if not isinstance(state, dict):
                raise ValueError("model_state.pt must contain a dict state_dict")
            state = _normalize_state_dict_keys(state)
            missing, unexpected = model.load_state_dict(state, strict=False)
            if missing:
                print(f"  (partial load) missing keys: {len(missing)}")
            if unexpected:
                print(f"  (partial load) unexpected keys: {len(unexpected)}")
            total_keys = len(list(model.state_dict().keys()))
            # Treat as ready if most weights loaded (buffers / renames may leave a few missing)
            weights_ready = len(missing) <= max(2, int(total_keys * 0.08))
            if not weights_ready:
                print(
                    "  Warning: many keys missing — checkpoint likely does not match "
                    "TacticClassifier (bert + classifier). Check Colab save format."
                )
            else:
                print("  model_state.pt applied")
        elif os.path.isfile(tactic_head_path):
            checkpoint = _torch_load(tactic_head_path)
            if "classifier_state" in checkpoint:
                model.classifier.load_state_dict(checkpoint["classifier_state"])
            else:
                model.classifier.load_state_dict(checkpoint)
            print("  tactic_head.pt applied to classifier only (DistilBERT backbone still random)")
            weights_ready = False
        else:
            print(
                "  ERROR: missing model_state.pt and tactic_head.pt.\n"
                "  Copy both files from your Colab zip into this folder (same folder as config.json):\n"
                f"     {asset_dir}"
            )

        model.to(DEVICE)
        model.eval()   # inference mode — no gradient tracking

        model_loaded = weights_ready
        if model_loaded:
            print(f"  Model weights OK — ready for inference on {DEVICE}")
        else:
            print(
                f"  Model NOT ready for real inference on {DEVICE} "
                "(random or partial weights). /health will report model_loaded=false."
            )
        return True

    except Exception as e:
        print(f"Model loading failed: {e}")
        model_loaded = False
        return False


# ─── GETTERS ─────────────────────────────────────────────────────

def get_model():
    return model

def get_tokenizer():
    return tokenizer

def is_model_loaded():
    return model_loaded

def get_device():
    return DEVICE

def get_tactic_labels():
    return TACTIC_LABELS