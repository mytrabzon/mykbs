import re
import json
from dataclasses import dataclass, asdict
from typing import Optional, Dict

import cv2
import numpy as np
import pytesseract


@dataclass
class MrzResult:
    raw_lines: Optional[str]
    document_number: Optional[str]
    surname: Optional[str]
    given_names: Optional[str]
    birth_date: Optional[str]  # YYYY-MM-DD
    expiry_date: Optional[str]  # YYYY-MM-DD
    nationality: Optional[str]
    success: bool
    error: Optional[str] = None


TD1_LINE_LENGTH = 30


def _preprocess_image(img: np.ndarray) -> np.ndarray:
    """
    Basic preprocessing:
    - grayscale
    - contrast enhancement
    - adaptive threshold
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Slight blur to reduce noise
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    # CLAHE for contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    # Adaptive threshold for dark-on-light MRZ
    th = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        15,
    )
    return th


def _find_mrz_region(th: np.ndarray) -> np.ndarray:
    """
    Try to automatically crop the MRZ area.
    - Emphasize horizontal text-like regions.
    - Prefer regions near the bottom of the image.
    Fallback: bottom 30% strip.
    """
    h, w = th.shape

    # Morphological operations to highlight horizontal regions
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    morph = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []

    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        area = cw * ch
        aspect = cw / float(ch + 1e-3)
        # Heuristic: MRZ is wide and relatively low height, and near bottom
        if area < (w * h * 0.01):
            continue
        if aspect < 5:
            continue
        candidates.append((y, x, cw, ch))

    if candidates:
        # Prefer the lowest candidate (largest y)
        candidates.sort(key=lambda c: c[0], reverse=True)
        y, x, cw, ch = candidates[0]
        y0 = max(0, y - int(ch * 0.3))
        y1 = min(h, y + ch + int(ch * 0.3))
        x0 = max(0, x - int(cw * 0.05))
        x1 = min(w, x + cw + int(cw * 0.05))
        return th[y0:y1, x0:x1]

    # Fallback: bottom 30% of image
    start_y = int(h * 0.7)
    return th[start_y:h, :]


def _ocr_mrz_region(mrz_img: np.ndarray) -> str:
    """
    Run Tesseract on the MRZ region.
    Config tuned for MRZ:
    - OCR-A like characters
    - Single block of text
    """
    config = "--oem 1 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
    text = pytesseract.image_to_string(mrz_img, config=config)
    return text.strip().upper()


def _normalize_lines(text: str) -> Optional[str]:
    """
    Normalize OCR output into exactly 3 lines for TD1.
    Remove invalid characters and enforce length ~30.
    """
    if not text:
        return None

    raw_lines = [l for l in text.splitlines() if l.strip()]
    # Clean characters
    clean_lines = []
    for line in raw_lines:
        line = re.sub(r"[^A-Z0-9<]", "", line.upper())
        if not line:
            continue
        clean_lines.append(line)

    # If already 3 lines and each reasonably long, accept
    if len(clean_lines) == 3:
        return "\n".join(l.ljust(TD1_LINE_LENGTH, "<")[:TD1_LINE_LENGTH] for l in clean_lines)

    # Concatenate and split into 3x30 chars
    concat = "".join(clean_lines)
    concat = re.sub(r"[^A-Z0-9<]", "", concat)
    if len(concat) < TD1_LINE_LENGTH * 2:
        return None

    l1 = concat[0:TD1_LINE_LENGTH]
    l2 = concat[TD1_LINE_LENGTH:TD1_LINE_LENGTH * 2]
    l3 = concat[TD1_LINE_LENGTH * 2:TD1_LINE_LENGTH * 3]
    return "\n".join([l1.ljust(TD1_LINE_LENGTH, "<"),
                      l2.ljust(TD1_LINE_LENGTH, "<"),
                      l3.ljust(TD1_LINE_LENGTH, "<")])


def _parse_td1(mrz_text: str) -> MrzResult:
    """
    Parse TD1 MRZ (3 lines, 30 chars each) for Turkish ID style documents.
    """
    if not mrz_text:
        return MrzResult(
            raw_lines=None,
            document_number=None,
            surname=None,
            given_names=None,
            birth_date=None,
            expiry_date=None,
            nationality=None,
            success=False,
            error="empty_mrz",
        )

    lines = mrz_text.splitlines()
    if len(lines) != 3:
        return MrzResult(
            raw_lines=mrz_text,
            document_number=None,
            surname=None,
            given_names=None,
            birth_date=None,
            expiry_date=None,
            nationality=None,
            success=False,
            error="not_td1_3_lines",
        )

    l1, l2, l3 = [l.ljust(TD1_LINE_LENGTH, "<")[:TD1_LINE_LENGTH] for l in lines]

    # Line 1: ID type, issuing state, names
    # Example: I<TURYILMAZ<<AHMET<<<<<<<<<<<<<<<
    doc_type = l1[0:2]
    # issuing_state = l1[2:5]
    names_field = l1[5:].strip("<")
    parts = names_field.split("<<", 1)
    surname = parts[0].replace("<", " ").strip() if parts else ""
    given_names = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""

    # Line 2: document number, nationality, birth, expiry, etc.
    # Example: A00000001<8TUR8001015M2501017<<<<<<<<<6
    line2 = l2
    doc_number = line2[0:9].replace("<", "").strip()
    # doc_number_check = line2[9]
    nationality = line2[10:13].replace("<", "").strip()
    birth = line2[13:19]
    # birth_check = line2[19]
    expiry = line2[21:27]
    # expiry_check = line2[27]

    def _yyMMdd_to_iso(yyMMdd: str) -> Optional[str]:
        if not re.fullmatch(r"\d{6}", yyMMdd):
            return None
        yy = int(yyMMdd[0:2])
        mm = int(yyMMdd[2:4])
        dd = int(yyMMdd[4:6])
        # Simple century guess: < 50 -> 2000+, else 1900+
        year = 2000 + yy if yy < 50 else 1900 + yy
        try:
            return f"{year:04d}-{mm:02d}-{dd:02d}"
        except ValueError:
            return None

    birth_iso = _yyMMdd_to_iso(birth)
    expiry_iso = _yyMMdd_to_iso(expiry)

    success = bool(doc_number and birth_iso and expiry_iso)

    return MrzResult(
        raw_lines=mrz_text,
        document_number=doc_number or None,
        surname=surname or None,
        given_names=given_names or None,
        birth_date=birth_iso,
        expiry_date=expiry_iso,
        nationality=nationality or None,
        success=success,
        error=None if success else "incomplete_fields",
    )


def read_mrz_from_image(image_path: str) -> MrzResult:
    """
    High-level helper:
    - Load image
    - Preprocess
    - Crop MRZ
    - OCR
    - Parse TD1
    """
    img = cv2.imread(image_path)
    if img is None:
        return MrzResult(
            raw_lines=None,
            document_number=None,
            surname=None,
            given_names=None,
            birth_date=None,
            expiry_date=None,
            nationality=None,
            success=False,
            error="image_not_found",
        )

    th = _preprocess_image(img)
    mrz_region = _find_mrz_region(th)
    text = _ocr_mrz_region(mrz_region)
    norm = _normalize_lines(text)
    if not norm:
        return MrzResult(
            raw_lines=text,
            document_number=None,
            surname=None,
            given_names=None,
            birth_date=None,
            expiry_date=None,
            nationality=None,
            success=False,
            error="normalize_failed",
        )
    return _parse_td1(norm)


def read_mrz_to_json(image_path: str) -> Dict:
    """
    Convenience wrapper: return JSON-serializable dict.
    """
    result = read_mrz_from_image(image_path)
    return asdict(result)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Read TD1 MRZ from Turkish ID card image.")
    parser.add_argument("image", help="Path to ID card image")
    parser.add_argument("--json", action="store_true", help="Print raw JSON result")
    args = parser.parse_args()

    res = read_mrz_to_json(args.image)
    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print("Success:", res.get("success"))
        if res.get("error"):
            print("Error:", res.get("error"))
        print("Document number:", res.get("document_number"))
        print("Surname:", res.get("surname"))
        print("Given names:", res.get("given_names"))
        print("Birth date:", res.get("birth_date"))
        print("Expiry date:", res.get("expiry_date"))
        print("Nationality:", res.get("nationality"))

