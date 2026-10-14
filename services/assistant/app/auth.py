# app/auth.py
# Login check: the app sends the user's FraudAware login token (issued by user-management).

from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Header, HTTPException

from app.config import get_settings


@dataclass(frozen=True)
class User:
    user_id: str
    # Forwarded to scam-detection so scans are linked to this user and rate-limited per user.
    token: str


def get_current_user(authorization: Optional[str] = Header(default=None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided. Please login.")

    secret = get_settings().jwt_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Authentication is not configured on the assistant service.")

    token = authorization[len("Bearer "):].strip()
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please login again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")

    user_id = str(payload.get("userId") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")
    return User(user_id=user_id, token=token)
