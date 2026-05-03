# app/ocr_pipeline.py

import os
import re
import cv2
import numpy as np
import pytesseract
from dotenv import load_dotenv

# Tesseract and CPU: very large phone photos are downscaled for speed; small images are upscaled for accuracy.
_MAX_IMAGE_EDGE = 2000
_MIN_WIDTH_FOR_OCR = 800

load_dotenv()

# ─── TESSERACT PATH (Windows only) ───────────────────────────────

TESSERACT_PATH = os.getenv(
    "TESSERACT_PATH",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)
if os.path.isfile(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


# ─── IMAGE PREPROCESSING ─────────────────────────────────────────

def preprocess_image(image: np.ndarray) -> np.ndarray:
    """
    Clean up the image so Tesseract can read it better.

    Steps:
      1. Grayscale
      2. Downscale if huge (faster OCR)
      3. Upscale if too narrow (Tesseract works best with enough resolution)
      4. Denoise (WhatsApp / JPEG artifacts)
      5. Mild unsharp mask (helps soft / compressed screenshots without harsh ringing)
      6. Adaptive threshold (chat bubbles, mixed backgrounds)
      7. Invert if the result is mostly black (dark-mode / light text on dark background)
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]

    # Downscale very large images (e.g. full camera resolution)
    max_edge = max(h, w)
    if max_edge > _MAX_IMAGE_EDGE:
        scale = _MAX_IMAGE_EDGE / max_edge
        gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA,
        )
        h, w = gray.shape[:2]

    # Upscale if too small
    if w < _MIN_WIDTH_FOR_OCR:
        scale = _MIN_WIDTH_FOR_OCR / w
        gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC,
        )

    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # Mild unsharp — safer than a hard 3x3 edge kernel on clean high-DPI screens
    blur = cv2.GaussianBlur(denoised, (0, 0), 1.0)
    sharpened = cv2.addWeighted(denoised, 1.5, blur, -0.5, 0)

    processed = cv2.adaptiveThreshold(
        sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,
        2,
    )

    # Dark-mode screenshots: light text on dark → threshold is mostly black; invert for Tesseract
    if float(processed.mean()) < 127.0:
        processed = cv2.bitwise_not(processed)

    return processed


# ─── TEXT CLEANING ────────────────────────────────────────────────

def clean_extracted_text(raw_text: str) -> str:
    """
    Clean up OCR output — Tesseract often includes junk characters,
    timestamps, and other non-message content from screenshots.
    """
    if not raw_text:
        return ""

    lines = raw_text.split("\n")
    clean_lines = []

    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip very short lines (single chars, page numbers)
        if len(line) < 3:
            continue

        # Skip lines that are just timestamps (e.g. "10:30 AM", "Yesterday")
        if re.match(r"^\d{1,2}:\d{2}\s*(AM|PM)?$", line, re.IGNORECASE):
            continue
        if re.match(r"^(yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$",
                    line, re.IGNORECASE):
            continue

        # Skip lines with only symbols
        if re.match(r"^[^a-zA-Z0-9]+$", line):
            continue

        clean_lines.append(line)

    cleaned = " ".join(clean_lines)

    # Remove extra whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned


# ─── MAIN OCR FUNCTION ────────────────────────────────────────────

def extract_text_from_image(image_bytes: bytes) -> dict:
    """
    Extract text from an uploaded image file.

    Args:
        image_bytes: raw bytes of the uploaded image

    Returns:
        {
          "success": bool,
          "extracted_text": str,
          "char_count": int,
          "error": str or None
        }
    """
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            return {
                "success": False,
                "extracted_text": "",
                "char_count": 0,
                "error": "Could not read image. Please upload a valid JPG or PNG file.",
            }

        # Preprocess
        processed = preprocess_image(image)

        # Run Tesseract OCR
        # PSM 6 = assume a block of text (good for chat screenshots)
        config = "--psm 6 --oem 3"
        raw_text = pytesseract.image_to_string(
            processed,
            lang="eng",
            config=config
        )

        # Clean up OCR output
        cleaned_text = clean_extracted_text(raw_text)

        if not cleaned_text:
            return {
                "success": False,
                "extracted_text": "",
                "char_count": 0,
                "error": "No text found in the image. Please upload a clear screenshot of the message."
            }

        return {
            "success": True,
            "extracted_text": cleaned_text,
            "char_count": len(cleaned_text),
            "error": None
        }

    except pytesseract.TesseractNotFoundError:
        return {
            "success": False,
            "extracted_text": "",
            "char_count": 0,
            "error": "Tesseract OCR is not installed. Please install it first."
        }

    except Exception as e:
        return {
            "success": False,
            "extracted_text": "",
            "char_count": 0,
            "error": f"Image processing failed: {str(e)}"
        }