# app/main.py

from fastapi import FastAPI
from app.database import connect_to_mongo, close_mongo, is_connected
from app.model_loader import load_model, is_model_loaded
from app.schemas import HealthResponse
from app.predictor import predict

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
    result = predict("Pay LKR 5000 before 5pm to confirm your slot")
    return result