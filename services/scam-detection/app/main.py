# app/main.py

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import (
    close_mongo,
    connect_to_mongo,
    delete_all_scans,
    delete_scan,
    get_scan_by_id,
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
    ScanDetailResponse,
    ScanDetailTactic,
    ScanDetailWord,
)
from app.security import Caller, enforce_rate_limit, get_caller, require_user
from app.upload_validation import MAX_REQUEST_BYTES, read_validated_image

app = FastAPI(
    title="FraudAware Scam Detection API",
    description="Detects psychological manipulation in recruiter messages",
    version="1.0.0",
)


def _cors_origins() -> list:
    raw = os.getenv("CORS_ORIGINS", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


# The mobile app does not need CORS; only browser origins listed in CORS_ORIGINS may call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Internal-Service-Key"],
)


@app.middleware("http")
async def reject_oversized_requests(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_REQUEST_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Image is larger than 5 MB."})
    return await call_next(request)


def _require_model_ready() -> None:
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")


def _require_history_storage() -> None:
    if not is_connected():
        raise HTTPException(status_code=503, detail="History storage unavailable.")


def _save_for_caller(caller: Caller, pred: dict, text: str, source: str) -> Optional[str]:
    """Save to the user's scan history. Service calls (chat-management) are never saved here:
    chat results live on the chat message, not in anyone's personal history."""
    if caller.internal or not caller.user_id:
        return None
    try:
        return save_scan(
            user_id=caller.user_id,
            original_text=text,
            is_scam=pred["is_scam"],
            confidence=pred["confidence"],
            tactics=pred["tactics"],
            word_importance=pred["word_importance"],
            warning=pred["warning"],
            what_gave_it_away=pred["what_gave_it_away"],
            source=source,
            extracted_text=text if source == "image" else None,
        )
    except Exception as e:
        logging.exception("Mongo save_scan failed: %s", e)
        return None


def _classify_response(pred: dict, text: str, source: str, scan_id: Optional[str]) -> ClassifyResponse:
    return ClassifyResponse(
        scan_id=scan_id,
        is_scam=pred["is_scam"],
        inconclusive=pred.get("inconclusive", False),
        confidence=pred["confidence"],
        label=pred["label"],
        tactics=pred["tactics"],
        word_importance=pred["word_importance"],
        warning=pred["warning"],
        what_gave_it_away=pred["what_gave_it_away"],
        original_text=text,
        extracted_text=text if source == "image" else None,
        source=source,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


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
def classify(req: ClassifyTextRequest, caller: Caller = Depends(get_caller)):
    enforce_rate_limit(caller)
    _require_model_ready()
    pred = predict(req.text)
    scan_id = _save_for_caller(caller, pred, req.text, "text")
    return _classify_response(pred, req.text, "text", scan_id)


@app.post("/classify-image", response_model=ClassifyResponse)
async def classify_image(
    file: UploadFile = File(...),
    caller: Caller = Depends(get_caller),
):
    enforce_rate_limit(caller)
    _require_model_ready()
    image_bytes = await read_validated_image(file)

    ocr = await run_in_threadpool(extract_text_from_image, image_bytes)
    if not ocr["success"]:
        raise HTTPException(
            status_code=400,
            detail=ocr.get("error") or "OCR failed.",
        )

    text = ocr["extracted_text"]
    pred = await run_in_threadpool(predict, text)
    scan_id = await run_in_threadpool(_save_for_caller, caller, pred, text, "image")
    return _classify_response(pred, text, "image", scan_id)


@app.post("/ocr-only")
async def ocr_only(
    file: UploadFile = File(...),
    caller: Caller = Depends(get_caller),
):
    """
    OCR endpoint for multi-screenshot flow.
    Does not run prediction and does not save to MongoDB.
    """
    enforce_rate_limit(caller)
    image_bytes = await read_validated_image(file)
    ocr = await run_in_threadpool(extract_text_from_image, image_bytes)
    return {
        "success": bool(ocr.get("success", False)),
        "extracted_text": (ocr.get("extracted_text") or "").strip(),
        "error": ocr.get("error"),
    }


def _normalize_tactics_for_detail(raw) -> list:
    out: list = []
    if not isinstance(raw, list):
        return out
    for t in raw:
        if isinstance(t, str):
            out.append(
                {
                    "name": t,
                    "key": t,
                    "score": 0.0,
                    "description": "",
                    "example": "",
                }
            )
            continue
        if not isinstance(t, dict):
            continue
        out.append(
            {
                "name": str(t.get("name") or t.get("title") or ""),
                "key": str(t.get("key") or t.get("name") or ""),
                "score": float(t.get("score") or 0.0),
                "description": str(t.get("description") or ""),
                "example": str(
                    t.get("example")
                    or t.get("description")
                    or t.get("snippet")
                    or ""
                ),
            }
        )
    return out


def _normalize_word_importance_for_detail(raw) -> list:
    out: list = []
    if not isinstance(raw, list):
        return out
    for w in raw:
        if not isinstance(w, dict):
            continue
        word = w.get("word")
        score = w.get("score")
        if isinstance(word, str) and isinstance(score, (int, float)):
            out.append({"word": word, "score": float(score)})
    return out


@app.get("/scan/{scan_id}", response_model=ScanDetailResponse)
def get_scan_detail(scan_id: str, user_id: str = Depends(require_user)):
    """Return one full scan for client detail views (e.g. recent scan bottom sheet)."""
    _require_history_storage()
    doc = get_scan_by_id(scan_id, user_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Scan not found.")

    tactics = _normalize_tactics_for_detail(doc.get("tactics"))
    words = _normalize_word_importance_for_detail(doc.get("word_importance"))
    original_text = str(doc.get("original_text") or "")

    return ScanDetailResponse(
        scan_id=str(doc.get("scan_id") or scan_id),
        is_scam=bool(doc.get("is_scam")),
        confidence=int(doc.get("confidence") or 0),
        original_text=original_text,
        source=str(doc.get("source") or "text"),
        created_at=doc.get("created_at"),
        extracted_text=doc.get("extracted_text"),
        tactics=[ScanDetailTactic(**t) for t in tactics],
        word_importance=[ScanDetailWord(**w) for w in words],
        warning=str(doc.get("warning") or ""),
        what_gave_it_away=str(doc.get("what_gave_it_away") or ""),
    )


@app.get("/history", response_model=HistoryResponse)
def history(user_id: str = Depends(require_user)):
    _require_history_storage()
    scans = get_scan_history(user_id)
    return HistoryResponse(user_id=user_id, total=len(scans), scans=scans)


@app.delete("/history")
def clear_history(user_id: str = Depends(require_user)):
    _require_history_storage()
    deleted = delete_all_scans(user_id)
    return {"success": True, "deleted_count": deleted}


@app.delete("/history/{scan_id}")
def delete_one(scan_id: str, user_id: str = Depends(require_user)):
    _require_history_storage()
    ok = delete_scan(scan_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return {"success": True, "message": "Scan deleted"}
