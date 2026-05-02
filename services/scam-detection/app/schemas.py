# app/schemas.py

from pydantic import BaseModel, validator
from typing import List, Optional


# ─── REQUEST SCHEMAS ─────────────────────────────────────────────

class ClassifyTextRequest(BaseModel):
    """What phone sends to POST /classify"""
    text: str
    user_id: str

    @validator('text')
    def text_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Text cannot be empty')
        if len(v) > 2000:
            raise ValueError('Text too long — max 2000 characters')
        return v.strip()

    @validator('user_id')
    def user_id_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('user_id cannot be empty')
        return v.strip()


# NOTE: Image upload uses FastAPI File() and Form() directly
# in main.py — not a Pydantic schema. This is because
# multipart/form-data (file uploads) cannot use JSON schemas.
# The image endpoint will use:
#   file: UploadFile = File(...)
#   user_id: str = Form(...)


# ─── RESPONSE SCHEMAS ────────────────────────────────────────────

class TacticResult(BaseModel):
    """One detected tactic inside the response"""
    name: str           # "Urgency Pressure"
    key: str            # "urgency"
    score: float        # 0.91
    description: str    # "Creates artificial time pressure..."


class WordImportance(BaseModel):
    """One word + its importance score"""
    word: str           # "Pay"
    score: float        # 0.31


class ClassifyResponse(BaseModel):
    """What backend returns to phone after analysis"""
    scan_id: Optional[str] = None
    is_scam: bool
    confidence: int                      # 94 (not 0.94)
    label: str                           # "SCAM DETECTED" or "LEGITIMATE"
    tactics: List[TacticResult]          # list of detected tactics
    word_importance: List[WordImportance] # top 5 trigger words
    warning: str                         # plain warning message
    what_gave_it_away: str               # plain explanation sentence
    original_text: str                   # the text that was analyzed
    extracted_text: Optional[str] = None # OCR result (image only)
    source: str = "text"                 # "text" or "image"
    created_at: Optional[str] = None


class HistoryItem(BaseModel):
    """One scan shown in history list"""
    scan_id: str
    is_scam: bool
    confidence: int
    tactics: List[str]      # ["urgency", "fomo"]
    preview_text: str       # first 80 chars of message
    source: str             # "text" or "image"
    created_at: str


class HistoryResponse(BaseModel):
    """Full history list returned to phone"""
    user_id: str
    total: int
    scans: List[HistoryItem]


class HealthResponse(BaseModel):
    """Health check — phone calls this to test connection"""
    status: str
    model_loaded: bool
    database_connected: bool