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
# If EasyOCR returns less than this (after cleaning), try Tesseract.
_MIN_CHARS_EASYOCR_OK = 18

load_dotenv()

# ─── TESSERACT PATH (Windows only) ───────────────────────────────

TESSERACT_PATH = os.getenv(
    "TESSERACT_PATH",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)
if os.path.isfile(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

# ─── EasyOCR (lazy singleton) ───────────────────────────────────

_easyocr_reader = None
_easyocr_init_done = False


def _use_gpu() -> bool:
    return os.getenv("EASYOCR_GPU", "").lower() in ("1", "true", "yes")


def get_easyocr_reader():
    """
    First call loads models (slow). Returns None if easyocr is missing or init fails.
    """
    global _easyocr_reader, _easyocr_init_done
    if _easyocr_init_done:
        return _easyocr_reader
    _easyocr_init_done = True
    try:
        import easyocr  # noqa: WPS433 — optional heavy dep, loaded once

        _easyocr_reader = easyocr.Reader(
            ["en"],
            gpu=_use_gpu(),
            verbose=False,
        )
    except Exception:
        _easyocr_reader = None
    return _easyocr_reader


def _resize_bgr_max_edge(image_bgr: np.ndarray, max_edge: int = _MAX_IMAGE_EDGE) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    m = max(h, w)
    if m <= max_edge:
        return image_bgr
    scale = max_edge / m
    return cv2.resize(
        image_bgr,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_AREA,
    )


def extract_text_easyocr(image_bgr: np.ndarray) -> str:
    """Run EasyOCR on BGR image; returns raw concatenated text (no cleaning)."""
    reader = get_easyocr_reader()
    if reader is None:
        return ""
    img = _resize_bgr_max_edge(image_bgr)
    # readtext: list of (bbox, text, confidence)
    results = reader.readtext(img)
    parts = []
    for item in results:
        if len(item) >= 3:
            text = item[1]
            conf = float(item[2])
            if text and conf >= 0.12:
                parts.append(text)
        elif len(item) >= 2:
            parts.append(item[1])
    return "\n".join(parts)


# ─── IMAGE PREPROCESSING (Tesseract) ─────────────────────────────


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
    Clean up OCR output — noise characters, timestamps, and junk lines.
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
        if re.match(
            r"^(yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$",
            line,
            re.IGNORECASE,
        ):
            continue

        # Skip lines with only symbols
        if re.match(r"^[^a-zA-Z0-9]+$", line):
            continue

        clean_lines.append(line)

    cleaned = " ".join(clean_lines)

    # Remove extra whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned


def extract_text_tesseract(image: np.ndarray) -> str:
    """Run legacy Tesseract pipeline; returns raw string."""
    processed = preprocess_image(image)
    config = "--psm 6 --oem 3"
    return pytesseract.image_to_string(processed, lang="eng", config=config)


# ─── MAIN OCR FUNCTION ────────────────────────────────────────────


def extract_text_from_image(image_bytes: bytes) -> dict:
    """
    Extract text from an uploaded image file.

    Uses EasyOCR first (better on chat screenshots), then Tesseract if output is too short
    or EasyOCR is unavailable.

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

        cleaned_text = ""
        easy_err = None
        tess_text = ""

        # 1) EasyOCR primary
        try:
            raw_easy = extract_text_easyocr(image)
            cleaned_easy = clean_extracted_text(raw_easy)
            if len(cleaned_easy) >= _MIN_CHARS_EASYOCR_OK:
                cleaned_text = cleaned_easy
            elif cleaned_easy:
                # Short EasyOCR result — keep for comparison but try Tesseract too
                cleaned_text = cleaned_easy
        except Exception as e:
            easy_err = str(e)

        # 2) Tesseract fallback: empty, short, or no EasyOCR
        need_tesseract = len(cleaned_text) < _MIN_CHARS_EASYOCR_OK
        if need_tesseract:
            try:
                raw_tess = extract_text_tesseract(image)
                tess_text = clean_extracted_text(raw_tess)
            except pytesseract.TesseractNotFoundError:
                if not cleaned_text:
                    return {
                        "success": False,
                        "extracted_text": "",
                        "char_count": 0,
                        "error": "Tesseract OCR is not installed. Install Tesseract or fix TESSERACT_PATH.",
                    }
            except Exception as e:
                if not cleaned_text:
                    return {
                        "success": False,
                        "extracted_text": "",
                        "char_count": 0,
                        "error": f"Image processing failed: {str(e)}",
                    }

            # Prefer longer / richer result when both ran
            if tess_text:
                if len(tess_text) > len(cleaned_text):
                    cleaned_text = tess_text
                elif not cleaned_text:
                    cleaned_text = tess_text

        if not cleaned_text and easy_err:
            return {
                "success": False,
                "extracted_text": "",
                "char_count": 0,
                "error": f"OCR failed: {easy_err}",
            }

        if not cleaned_text:
            return {
                "success": False,
                "extracted_text": "",
                "char_count": 0,
                "error": "No text found in the image. Please upload a clear screenshot of the message.",
            }

        return {
            "success": True,
            "extracted_text": cleaned_text,
            "char_count": len(cleaned_text),
            "error": None,
        }

    except pytesseract.TesseractNotFoundError:
        return {
            "success": False,
            "extracted_text": "",
            "char_count": 0,
            "error": "Tesseract OCR is not installed. Please install it first.",
        }

    except Exception as e:
        return {
            "success": False,
            "extracted_text": "",
            "char_count": 0,
            "error": f"Image processing failed: {str(e)}",
        }
