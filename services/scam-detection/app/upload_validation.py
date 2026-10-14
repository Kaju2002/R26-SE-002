# app/upload_validation.py
# Image upload checks run before OCR: size, real file type (magic bytes), pixel count.

import io
import warnings
from typing import Optional

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# 25 MP covers any phone screenshot; larger images are rejected before decoding.
MAX_IMAGE_PIXELS = 25_000_000
# Multipart boundaries and form fields on top of the file itself.
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 512 * 1024

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def detect_image_type(data: bytes) -> Optional[str]:
    """Return 'jpeg', 'png' or 'webp' from the file header, ignoring the declared type."""
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def validate_image_bytes(data: bytes) -> str:
    """Raise HTTPException if data is not an acceptable image. Returns the detected type."""
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 5 MB.")

    kind = detect_image_type(data)
    if kind is None:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG or WebP images are allowed.",
        )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            # open() reads only the header, so huge images are rejected without decoding.
            with Image.open(io.BytesIO(data)) as img:
                width, height = img.size
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=413, detail="Image dimensions are too large.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Could not read image file.")

    if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="Image dimensions are too large.")
    return kind


async def read_validated_image(file: UploadFile) -> bytes:
    """Read at most MAX_UPLOAD_BYTES + 1 bytes and validate them."""
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    validate_image_bytes(data)
    return data
