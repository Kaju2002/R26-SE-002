# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_to_mongo, close_mongo, is_connected
from app.schemas import HealthResponse

app = FastAPI(
    title="FraudAware Scam Detection API",
    description="Detects psychological manipulation tactics in recruiter messages",
    version="1.0.0",
)

# Browsers (Expo Web, /docs from another origin, etc.) require CORS on cross-origin requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── STARTUP / SHUTDOWN ──────────────────────────────────────────

@app.on_event("startup")
def startup():
    connect_to_mongo()


@app.on_event("shutdown")
def shutdown():
    close_mongo()


# ─── HEALTH CHECK ────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "model_loaded": False,   # will be True after model_loader added
        "database_connected": is_connected()
    }