# app/main.py

import logging
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    close_mongo,
    connect_to_mongo,
    delete_all_scans,
    delete_scan,
    get_scan_history,
    is_connected,
    save_scan,
)
from app.model_loader import is_model_loaded, load_model, load_phase1_model
from app.ocr_pipeline import extract_text_from_image

from app.predictor import predict
from app.schemas import (
    ClassifyResponse,
    ClassifyTextRequest,
    HealthResponse,
    HistoryResponse,
)

app = FastAPI(
    title="FraudAware Scam Detection API",
    description="Detects psychological manipulation in recruiter messages",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


def _require_model_ready() -> None:
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")


# ─── STARTUP / SHUTDOWN ──────────────────────────────────────────


@app.on_event("startup")
def startup():
    connect_to_mongo()
    load_model()
    load_phase1_model()


@app.on_event("shutdown")
def shutdown():
    close_mongo()


# ─── ROUTES ──────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "model_loaded": is_model_loaded(),
        "database_connected": is_connected(),
    }


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyTextRequest):
    _require_model_ready()
    pred = predict(req.text)

    scan_id = None
    try:
        scan_id = save_scan(
            user_id=req.user_id,
            original_text=req.text,
            is_scam=pred["is_scam"],
            confidence=pred["confidence"],
            tactics=pred["tactics"],
            word_importance=pred["word_importance"],
            warning=pred["warning"],
            what_gave_it_away=pred["what_gave_it_away"],
            source="text",
        )
    except Exception as e:
        logging.exception("Mongo save_scan failed: %s", e)

    return ClassifyResponse(
        scan_id=scan_id,
        is_scam=pred["is_scam"],
        confidence=pred["confidence"],
        label=pred["label"],
        tactics=pred["tactics"],
        word_importance=pred["word_importance"],
        warning=pred["warning"],
        what_gave_it_away=pred["what_gave_it_away"],
        original_text=req.text,
        source="text",
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/classify-image", response_model=ClassifyResponse)
async def classify_image(
    file: UploadFile = File(...),
    user_id: str = Form(..., min_length=1),
):
    _require_model_ready()

    ct = file.content_type or ""
    if ct and not ct.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be an image (JPG/PNG).",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")

    ocr = extract_text_from_image(image_bytes)
    if not ocr["success"]:
        raise HTTPException(
            status_code=400,
            detail=ocr.get("error") or "OCR failed.",
        )

    text = ocr["extracted_text"]
    pred = predict(text)

    scan_id = None
    try:
        scan_id = save_scan(
            user_id=user_id.strip(),
            original_text=text,
            is_scam=pred["is_scam"],
            confidence=pred["confidence"],
            tactics=pred["tactics"],
            word_importance=pred["word_importance"],
            warning=pred["warning"],
            what_gave_it_away=pred["what_gave_it_away"],
            source="image",
            extracted_text=text,
        )
    except Exception as e:
        logging.exception("Mongo save_scan failed: %s", e)

    return ClassifyResponse(
        scan_id=scan_id,
        is_scam=pred["is_scam"],
        confidence=pred["confidence"],
        label=pred["label"],
        tactics=pred["tactics"],
        word_importance=pred["word_importance"],
        warning=pred["warning"],
        what_gave_it_away=pred["what_gave_it_away"],
        original_text=text,
        extracted_text=text,
        source="image",
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/history/{user_id}", response_model=HistoryResponse)
def history(user_id: str):
    if not is_connected():
        raise HTTPException(
            status_code=503,
            detail="History storage unavailable.",
        )
    scans = get_scan_history(user_id)
    return HistoryResponse(user_id=user_id, total=len(scans), scans=scans)


@app.delete("/history/clear/{user_id}")
def clear_history(user_id: str):
    if not is_connected():
        raise HTTPException(
            status_code=503,
            detail="History storage unavailable.",
        )
    deleted = delete_all_scans(user_id)
    return {"success": True, "deleted_count": deleted}


@app.delete("/history/{scan_id}")
def delete_one(scan_id: str):
    if not is_connected():
        raise HTTPException(
            status_code=503,
            detail="History storage unavailable.",
        )
    ok = delete_scan(scan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return {"success": True, "message": "Scan deleted"}
