# app/database.py

import os
from datetime import datetime
from typing import Optional
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# ─── CONNECTION ──────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI")
client = None
db = None

def connect_to_mongo():
    """Call this once when FastAPI starts."""
    global client, db
    if not MONGO_URI or not str(MONGO_URI).strip():
        print("❌ MongoDB connection failed: MONGO_URI is missing or empty in .env")
        client, db = None, None
        return False
    try:
        client = MongoClient(
            MONGO_URI,
            tls=True,
            tlsAllowInvalidCertificates=True,
        )
        db = client["fraudaware"]
        client.admin.command("ping")
        print(" MongoDB connected successfully")
        return True
    except Exception as e:
        print(f" MongoDB connection failed: {e}")
        client, db = None, None
        return False


def is_connected():
    """Check if MongoDB is connected."""
    if client is None:
        return False
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False

def close_mongo():
    """Call this when FastAPI shuts down."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


# ─── SAVE SCAN ───────────────────────────────────────────────────

def save_scan(
    user_id: str,
    original_text: str,
    is_scam: bool,
    confidence: int,
    tactics: list,
    word_importance: list,
    warning: str,
    what_gave_it_away: str,
    source: str = "text",
    extracted_text: Optional[str] = None,
):
    """
    Save one scan result to MongoDB.
    Returns the inserted scan_id as string.
    """
    if db is None:
        return None

    document = {
        "user_id": user_id,
        "original_text": original_text,
        "is_scam": is_scam,
        "confidence": confidence,
        "tactics": tactics,
        "word_importance": word_importance,
        "warning": warning,
        "what_gave_it_away": what_gave_it_away,
        "source": source,
        "extracted_text": extracted_text,
        "created_at": datetime.utcnow(),
    }

    result = db["scans"].insert_one(document)
    return str(result.inserted_id)


# ─── GET HISTORY ─────────────────────────────────────────────────

def get_scan_history(user_id: str, limit: int = 50):
    """
    Get all scans for a user, newest first.
    Returns list of scan dicts.
    """
    if db is None:
        return []

    scans = db["scans"].find(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        limit=limit
    )

    result = []
    for scan in scans:
        result.append({
            "scan_id": str(scan["_id"]),
            "is_scam": scan["is_scam"],
            "confidence": scan["confidence"],
            "tactics": [t["key"] for t in scan.get("tactics", [])],
            "preview_text": scan["original_text"][:80] + "..."
                           if len(scan["original_text"]) > 80
                           else scan["original_text"],
            "source": scan.get("source", "text"),
            "created_at": scan["created_at"].isoformat(),
        })

    return result


# ─── GET ONE SCAN ─────────────────────────────────────────────────

def get_scan_by_id(scan_id: str):
    """Get one scan by its ID."""
    if db is None:
        return None
    try:
        scan = db["scans"].find_one({"_id": ObjectId(scan_id)})
        if scan:
            scan["scan_id"] = str(scan["_id"])
            del scan["_id"]
            scan["created_at"] = scan["created_at"].isoformat()
        return scan
    except:
        return None


# ─── DELETE SCAN ─────────────────────────────────────────────────

def delete_scan(scan_id: str):
    """Delete one scan by ID."""
    if db is None:
        return False
    try:
        result = db["scans"].delete_one({"_id": ObjectId(scan_id)})
        return result.deleted_count > 0
    except:
        return False


def delete_all_scans(user_id: str):
    """Delete all scans for a user."""
    if db is None:
        return 0
    result = db["scans"].delete_many({"user_id": user_id})
    return result.deleted_count