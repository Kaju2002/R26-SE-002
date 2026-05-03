# app/main.py

from fastapi import FastAPI
from app.database import connect_to_mongo, close_mongo, is_connected
from app.model_loader import load_model, is_model_loaded
from app.schemas import HealthResponse
from app.predictor import predict
from fastapi import UploadFile, File
from app.ocr_pipeline import extract_text_from_image

app = FastAPI(
    title="FraudAware Scam Detection API",
    description="Detects psychological manipulation in recruiter messages",
    version="1.0.0"
)


# ─── STARTUP / SHUTDOWN ──────────────────────────────────────────

@app.on_event("startup")
def startup():
    connect_to_mongo()
    load_model()


@app.on_event("shutdown")
def shutdown():
    close_mongo()


# ─── HEALTH CHECK ────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "model_loaded": is_model_loaded(),
        "database_connected": is_connected()
    }

@app.get("/test-predict")
def test_predict():
    result = predict("interview schedule confirmation message")
    return result

@app.post("/test-ocr")
async def test_ocr(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = extract_text_from_image(image_bytes)
    return result

from fastapi import UploadFile, File, Form
from app.ocr_pipeline import extract_text_from_image
from app.predictor import predict

@app.post("/test-full-pipeline")
async def test_full_pipeline(file: UploadFile = File(...)):
    # Step 1: OCR
    image_bytes = await file.read()
    ocr_result = extract_text_from_image(image_bytes)
    
    if not ocr_result["success"]:
        return {"error": ocr_result["error"]}
    
    # Step 2: Predict
    prediction = predict(ocr_result["extracted_text"])
    
    # Step 3: Return combined result
    return {
        "extracted_text": ocr_result["extracted_text"],
        "prediction": prediction
    }
    