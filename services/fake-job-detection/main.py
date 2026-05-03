import os
import base64
import torch
import torch.nn.functional as F
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import anthropic

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


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    # --- Step 1: extract text from image via Claude Vision ---
    try:
        extracted_text = await _extract_text_from_image(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image text extraction failed: {e}")

    # --- Step 2: run XLM-RoBERTa inference ---
    try:
        tokenizer = state["tokenizer"]
        model = state["model"]

        inputs = tokenizer(
            extracted_text,
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
        # Adjust threshold to reduce false positives
        FAKE_THRESHOLD = 0.85

        if fake_prob >= FAKE_THRESHOLD:
            prediction = "fake"
            confidence = round(fake_prob, 4)
            message = f"This job post has been detected as FAKE with {round(fake_prob * 100)}% confidence"
        elif fake_prob >= 0.50:
            prediction = "suspicious"
            confidence = round(fake_prob, 4)
            message = f"This job post is SUSPICIOUS with {round(fake_prob * 100)}% confidence"
        else:
            prediction = "legitimate"
            confidence = round(legit_prob, 4)
            message = f"This job post has been detected as LEGITIMATE with {round(legit_prob * 100)}% confidence"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    return {
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "legitimate_probability": round(legit_prob, 4),
        "fake_probability": round(fake_prob, 4),
        "extracted_text": extracted_text[:300],
        "message": message,
    }
