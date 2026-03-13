"""
Tesseract tabanlı MRZ okuyucu (Paddle/OmniMRZ yokken kullanılır).
TD1 (3x30) kimlik kartı formatı. Bytes veya dosya yolu ile çalışır.
"""
import re
import tempfile
import os
from typing import Optional, Dict, Any

import cv2
import numpy as np
import pytesseract


TD1_LINE_LENGTH = 30


def _preprocess(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    th = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15
    )
    return th


def _find_mrz_region(th: np.ndarray) -> np.ndarray:
    h, w = th.shape
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    morph = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        area = cw * ch
        aspect = cw / float(ch + 1e-3)
        if area < (w * h * 0.01) or aspect < 5:
            continue
        candidates.append((y, x, cw, ch))
    if candidates:
        candidates.sort(key=lambda c: c[0], reverse=True)
        y, x, cw, ch = candidates[0]
        y0 = max(0, y - int(ch * 0.3))
        y1 = min(h, y + ch + int(ch * 0.3))
        x0 = max(0, x - int(cw * 0.05))
        x1 = min(w, x + cw + int(cw * 0.05))
        return th[y0:y1, x0:x1]
    start_y = int(h * 0.7)
    return th[start_y:h, :]


def _ocr_mrz(mrz_img: np.ndarray) -> str:
    config = "--oem 1 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
    return pytesseract.image_to_string(mrz_img, config=config).strip().upper()


def _normalize_lines(text: str) -> Optional[str]:
    if not text:
        return None
    raw = [re.sub(r"[^A-Z0-9<]", "", l.upper()) for l in text.splitlines() if l.strip()]
    raw = [l for l in raw if l]
    if len(raw) == 3:
        return "\n".join(l.ljust(TD1_LINE_LENGTH, "<")[:TD1_LINE_LENGTH] for l in raw)
    concat = re.sub(r"[^A-Z0-9<]", "", "".join(raw))
    if len(concat) < TD1_LINE_LENGTH * 2:
        return None
    l1 = concat[0:TD1_LINE_LENGTH].ljust(TD1_LINE_LENGTH, "<")
    l2 = concat[TD1_LINE_LENGTH : TD1_LINE_LENGTH * 2].ljust(TD1_LINE_LENGTH, "<")
    l3 = concat[TD1_LINE_LENGTH * 2 : TD1_LINE_LENGTH * 3].ljust(TD1_LINE_LENGTH, "<")
    return "\n".join([l1, l2, l3])


def _yyMMdd_to_iso(yyMMdd: str) -> Optional[str]:
    if not re.fullmatch(r"\d{6}", yyMMdd):
        return None
    yy, mm, dd = int(yyMMdd[0:2]), int(yyMMdd[2:4]), int(yyMMdd[4:6])
    year = 2000 + yy if yy < 50 else 1900 + yy
    return f"{year:04d}-{mm:02d}-{dd:02d}"


def _parse_td1(mrz_text: str) -> Dict[str, Any]:
    if not mrz_text:
        return {"success": False, "error": "empty_mrz"}
    lines = mrz_text.splitlines()
    if len(lines) != 3:
        return {"success": False, "error": "not_td1_3_lines"}
    l1, l2, l3 = [l.ljust(TD1_LINE_LENGTH, "<")[:TD1_LINE_LENGTH] for l in lines]
    names_field = l1[5:].strip("<")
    parts = names_field.split("<<", 1)
    surname = (parts[0].replace("<", " ").strip() if parts else "") or ""
    given_names = (parts[1].replace("<", " ").strip() if len(parts) > 1 else "") or ""
    doc_number = l2[0:9].replace("<", "").strip()
    nationality = l2[10:13].replace("<", "").strip()
    birth_iso = _yyMMdd_to_iso(l2[13:19])
    expiry_iso = _yyMMdd_to_iso(l2[21:27])
    issuing_country = l1[2:5].replace("<", "").strip()
    success = bool(doc_number and birth_iso and expiry_iso)
    return {
        "success": success,
        "raw_lines": mrz_text,
        "document_number": doc_number or "",
        "surname": surname,
        "given_names": given_names,
        "birth_date": birth_iso or "",
        "expiry_date": expiry_iso or "",
        "nationality": nationality or "",
        "issuing_country": issuing_country or "",
        "error": None if success else "incomplete_fields",
    }


def read_mrz_from_bytes(image_bytes: bytes) -> Dict[str, Any]:
    """Görsel bytes'tan MRZ oku. Backend ile uyumlu mrzPayload döner."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"success": False, "error": "image_not_found", "mrzPayload": None}
    th = _preprocess(img)
    mrz_region = _find_mrz_region(th)
    text = _ocr_mrz(mrz_region)
    norm = _normalize_lines(text)
    if not norm:
        return {"success": False, "error": "normalize_failed", "mrzPayload": None}
    parsed = _parse_td1(norm)
    if not parsed.get("success"):
        return {
            "success": False,
            "error": parsed.get("error", "parse_failed"),
            "mrzPayload": None,
        }
    # Backend mrzPayload formatı
    mrz_payload = {
        "documentNumber": parsed.get("document_number", ""),
        "birthDate": parsed.get("birth_date", ""),
        "expiryDate": parsed.get("expiry_date", ""),
        "surname": parsed.get("surname", ""),
        "givenNames": parsed.get("given_names", ""),
        "issuingCountry": parsed.get("issuing_country", ""),
        "nationality": parsed.get("nationality", ""),
    }
    lines = parsed["raw_lines"].splitlines()
    return {
        "success": True,
        "mrz": parsed["raw_lines"],
        "extraction": {
            "line1": lines[0] if len(lines) > 0 else "",
            "line2": lines[1] if len(lines) > 1 else "",
            "line3": lines[2] if len(lines) > 2 else "",
        },
        "mrzPayload": mrz_payload,
        "validation": {
            "structural": "PASS",
            "checksum": "UNKNOWN",
            "logical": "UNKNOWN",
        },
    }


def read_mrz_from_path(image_path: str) -> Dict[str, Any]:
    with open(image_path, "rb") as f:
        return read_mrz_from_bytes(f.read())
