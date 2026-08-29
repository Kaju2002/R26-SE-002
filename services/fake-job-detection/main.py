import os
import base64
import torch
import torch.nn.functional as F
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import anthropic
from explain import explain_text

MODEL_DIR = "./fake_job_model"

# Shared state for model/tokenizer loaded at startup
state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["tokenizer"] = AutoTokenizer.from_pretrained(MODEL_DIR)
    state["model"] = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
    state["model"].eval()
    yield
    state.clear()


app = FastAPI(title="Fake Job Detector", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


async def _extract_text_from_image(image: UploadFile) -> str:
    image_bytes = await image.read()
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    media_type = image.content_type or "image/jpeg"

    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract all text from this job advertisement image. "
                            "Return only the raw text, no formatting, no labels."
                        ),
                    },
                ],
            }
        ],
    )
    return response.content[0].text.strip()


@app.get("/health")
def health():
    return {"status": "ok", "model": "XLM-RoBERTa Fake Job Detector"}


@app.post("/extract-text")
async def extract_text(image: UploadFile = File(...)):
    try:
        extracted_text = await _extract_text_from_image(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image text extraction failed: {e}")

    return {
        "extracted_text": extracted_text,
        "character_count": len(extracted_text),
        "word_count": len(extracted_text.split()),
    }


def _run_text_inference(text: str) -> dict:
    tokenizer = state["tokenizer"]
    model = state["model"]

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )

    with torch.no_grad():
        logits = model(**inputs).logits

    probs = F.softmax(logits, dim=-1).squeeze()
    fake_prob = float(probs[1])
    legit_prob = float(probs[0])

    # Calibrated threshold based on training distribution
    # Training had 1191 legitimate vs 533 fake (69% vs 31%)
    FAKE_THRESHOLD = 0.85

    decided = decide_from_probabilities(fake_prob, legit_prob, fake_threshold=FAKE_THRESHOLD)
    return decided


def decide_from_probabilities(
    fake_prob: float,
    legit_prob: float,
    fake_threshold: float = 0.85,
) -> dict:
    """Map class probabilities to fake / suspicious / legitimate (unit-testable)."""
    if fake_prob >= fake_threshold:
        prediction = "fake"
        confidence = round(fake_prob, 4)
        message = (
            f"This job post has been detected as FAKE with {round(fake_prob * 100)}% confidence"
        )
    elif fake_prob >= 0.50:
        prediction = "suspicious"
        confidence = round(fake_prob, 4)
        message = (
            f"This job post is SUSPICIOUS with {round(fake_prob * 100)}% confidence"
        )
    else:
        prediction = "legitimate"
        confidence = round(legit_prob, 4)
        message = (
            f"This job post has been detected as LEGITIMATE with {round(legit_prob * 100)}% confidence"
        )

    return {
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "legitimate_probability": round(legit_prob, 4),
        "fake_probability": round(fake_prob, 4),
        "message": message,
    }


def _with_explanations(result: dict, text: str) -> dict:
    try:
        explanations = explain_text(text, state["tokenizer"], state["model"])
    except Exception:
        explanations = {"lime": [], "shap": []}
    return {**result, "lime": explanations.get("lime") or [], "shap": explanations.get("shap") or []}


@app.post("/predict-text")
async def predict_text(payload: dict):
    """Classify a job post from raw text (dashboard / API clients)."""
    text = str(payload.get("text") or "").strip()
    if len(text) < 15:
        raise HTTPException(
            status_code=400,
            detail="Provide at least 15 characters of job post text.",
        )

    try:
        result = _run_text_inference(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    return {
        **result,
        "extracted_text": text[:2000],
        "lime": [],
        "shap": [],
    }


@app.post("/explain-text")
async def explain_job_text(payload: dict):
    """LIME + Partition SHAP (shap library) token highlights for a job-post text blob."""
    text = str(payload.get("text") or "").strip()
    if len(text) < 15:
        raise HTTPException(
            status_code=400,
            detail="Provide at least 15 characters of job post text.",
        )

    try:
        result = _run_text_inference(text)
        return {
            **_with_explanations(result, text),
            "extracted_text": text[:2000],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {e}")


def calculate_signal_score(text: str) -> dict:
    """Keyword-based fraud signal score to combine with model probability."""
    text_lower = text.lower()

    fake_signals_found = []
    legit_signals_found = []
    score = 0

    # Strong fake signals — score +2 each
    strong_fake = [
        ("registration fee", "Registration fee required"),
        ("training fee", "Training fee required"),
        ("deposit required", "Deposit required"),
        ("pay to apply", "Payment to apply"),
        ("earn daily", "Daily earning promise"),
        ("15 minutes", "15 minute contact promise"),
        ("unlimited income", "Unlimited income promise"),
    ]

    # Moderate fake signals — score +1 each
    moderate_fake = [
        ("work from home", "Work from home"),
        ("data entry", "Data entry job"),
        ("no experience", "No experience needed"),
        ("whatsapp only", "WhatsApp only contact"),
        ("gmail.com", "Personal Gmail contact"),
        ("yahoo.com", "Personal Yahoo contact"),
        ("part time easy", "Easy part time"),
        ("urgent hiring", "Urgent hiring language"),
    ]

    # Legitimate signals — score -1 each
    legit_signals = [
        ("pvt ltd", "Registered company"),
        ("private limited", "Registered company"),
        (" plc", "Public listed company"),
        ("epf", "EPF benefits"),
        ("etf", "ETF benefits"),
        ("bachelor", "Degree requirement"),
        ("years of experience", "Experience requirement"),
        ("recruitment@", "Corporate recruitment email"),
        ("careers@", "Corporate careers email"),
        ("colombo 0", "Colombo office address"),
    ]

    for keyword, label in strong_fake:
        if keyword in text_lower:
            score += 2
            fake_signals_found.append(label)

    for keyword, label in moderate_fake:
        if keyword in text_lower:
            score += 1
            fake_signals_found.append(label)

    for keyword, label in legit_signals:
        if keyword in text_lower:
            score -= 1
            legit_signals_found.append(label)

    return {
        "score": score,
        "fake_signals": fake_signals_found,
        "legit_signals": legit_signals_found,
    }


def determine_tier(fake_prob: float, signal_score: int) -> dict:
    """Combine model probability with signal score into a fake/suspicious/legitimate tier."""

    # FAKE — high model confidence + multiple signals
    if fake_prob >= 0.85 and signal_score >= 2:
        return {
            "tier": "fake",
            "color": "red",
            "message": "HIGH RISK — This job post shows strong indicators of fraud. Do not apply.",
            "advice": [
                "Do not pay any registration or training fees",
                "Do not share personal documents",
                "Report this post to the platform",
                "Verify the company independently before any contact",
            ],
        }

    # FAKE — very high model confidence even without signals
    elif fake_prob >= 0.92:
        return {
            "tier": "fake",
            "color": "red",
            "message": "HIGH RISK — AI model detected strong fraud patterns in this post.",
            "advice": [
                "Do not apply for this position",
                "Do not share personal or financial information",
                "Report this post to the platform",
            ],
        }

    # SUSPICIOUS — moderate probability or signals present
    elif fake_prob >= 0.50 or signal_score >= 1:
        return {
            "tier": "suspicious",
            "color": "amber",
            "message": "CAUTION — This post has some suspicious characteristics. Verify before applying.",
            "advice": [
                "Research the company name independently",
                "Never pay any upfront fees",
                "Verify contact details through official channels",
                "Check company registration with BOI or ROC",
            ],
        }

    # LEGITIMATE — low probability + no signals
    else:
        return {
            "tier": "legitimate",
            "color": "green",
            "message": "LOW RISK — This post appears to be a genuine job advertisement.",
            "advice": [
                "Always research the company before applying",
                "Apply through official channels only",
                "Never pay fees even for legitimate jobs",
            ],
        }


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    # --- Step 1: extract text from image via Claude Vision ---
    try:
        extracted_text = await _extract_text_from_image(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image text extraction failed: {e}")

    # --- Step 2: run XLM-RoBERTa inference ---
    if len(extracted_text) < 15:
        return {
            "prediction": "skipped",
            "confidence": 0,
            "legitimate_probability": None,
            "fake_probability": None,
            "message": "Poster image had too little text to classify.",
            "extracted_text": extracted_text[:2000],
            "lime": [],
            "shap": [],
        }

    try:
        result = _run_text_inference(extracted_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    # --- Step 3: three-tier classification — model probability + signal scoring ---
    fake_prob = result["fake_probability"]
    legit_prob = result["legitimate_probability"]
    signals = calculate_signal_score(extracted_text)
    tier_result = determine_tier(fake_prob, signals["score"])

    response = {
        "prediction": tier_result["tier"],
        "tier": tier_result["tier"],
        "color": tier_result["color"],
        "confidence": round(float(fake_prob), 4),
        "legitimate_probability": round(float(legit_prob), 4),
        "fake_probability": round(float(fake_prob), 4),
        "signal_score": signals["score"],
        "fake_signals_found": signals["fake_signals"],
        "legit_signals_found": signals["legit_signals"],
        "message": tier_result["message"],
        "advice": tier_result["advice"],
        "extracted_text": extracted_text[:500],
    }

    return _with_explanations(response, extracted_text)
