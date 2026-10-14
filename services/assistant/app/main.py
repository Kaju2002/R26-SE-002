# app/main.py

import asyncio

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.schemas import HealthResponse

app = FastAPI(
    title="FraudAware Assistant API",
    description="Conversational job-scam checker built on the FraudAware detection services",
    version="0.1.0",
)

# The mobile app does not need CORS; only browser origins listed in CORS_ORIGINS may call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def _dependency_probes() -> dict:
    """Service name -> URL that answers when the service is running."""
    s = get_settings()
    return {
        "scam_detection": f"{s.scam_detection_url}/health",
        "employer_verification": f"{s.employer_verification_url}/",
        "fake_job_detection": f"{s.fake_job_detection_url}/health",
    }


async def _probe(client: httpx.AsyncClient, url: str) -> str:
    try:
        response = await client.get(url)
        return "up" if response.status_code < 500 else "down"
    except httpx.HTTPError:
        return "down"


# ─── ROUTES ──────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    probes = _dependency_probes()
    async with httpx.AsyncClient(timeout=settings.health_timeout_seconds) as client:
        results = await asyncio.gather(*(_probe(client, url) for url in probes.values()))
    services = dict(zip(probes.keys(), results))

    return {
        "status": "ok" if all(v == "up" for v in services.values()) else "degraded",
        "llm": {
            "provider": settings.llm_provider,
            "configured": settings.llm_configured,
            "model": settings.gemini_model,
        },
        "services": services,
    }
