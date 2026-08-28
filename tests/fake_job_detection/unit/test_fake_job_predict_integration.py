"""
Optional integration — real XLM-RoBERTa inference.
Skipped when fake_job_model weights are incomplete / unloadable.
"""

from __future__ import annotations

from pathlib import Path

import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[3] / "services" / "fake-job-detection"
MODEL_DIR = SERVICE_ROOT / "fake_job_model"


def _model_files_present() -> bool:
    needed = ["config.json", "tokenizer.json", "tokenizer_config.json"]
    if not all((MODEL_DIR / name).is_file() for name in needed):
        return False
    # Weight file names vary (pytorch_model.bin / model.safetensors)
    weight_names = [
        "pytorch_model.bin",
        "model.safetensors",
        "model.safetensors.index.json",
    ]
    return any((MODEL_DIR / name).is_file() for name in weight_names)


@pytest.fixture(scope="module")
def model_ready() -> bool:
    if not _model_files_present():
        return False
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
        model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
        model.eval()
        return tokenizer is not None and model is not None
    except Exception:
        return False


def test_run_inference_on_fake_fixture(model_ready: bool, samples: dict):
    if not model_ready:
        pytest.skip("fake_job_model weights not available")

    from tests.service_imports import import_module
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    fake_main = import_module("fake-job-detection", "main")
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.eval()
    fake_main.state["tokenizer"] = tokenizer
    fake_main.state["model"] = model

    text = samples["fake_samples"][0]["text"]
    result = fake_main._run_text_inference(text)
    assert result["prediction"] in ("fake", "suspicious", "legitimate")
    assert "fake_probability" in result
    assert 0.0 <= result["fake_probability"] <= 1.0


def test_run_inference_on_legit_fixture(model_ready: bool, samples: dict):
    if not model_ready:
        pytest.skip("fake_job_model weights not available")

    from tests.service_imports import import_module
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    fake_main = import_module("fake-job-detection", "main")
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.eval()
    fake_main.state["tokenizer"] = tokenizer
    fake_main.state["model"] = model

    text = samples["legit_samples"][0]["text"]
    result = fake_main._run_text_inference(text)
    assert result["prediction"] in ("fake", "suspicious", "legitimate")
    assert "legitimate_probability" in result
