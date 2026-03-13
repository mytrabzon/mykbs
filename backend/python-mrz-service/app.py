"""
Python MRZ servisi - OmniMRZ (Paddle) veya Tesseract ile TD1/TD2/TD3 okuma.
OmniMRZ kurulu değilse (örn. Python 3.14 / Windows) Tesseract kullanılır.
"""
import base64
import io
import logging
import os
import tempfile
from datetime import datetime

from flask import Flask, request, jsonify
from PIL import Image

from tesseract_mrz import read_mrz_from_bytes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# OmniMRZ varsa kullan (Paddle kurulu ortamlarda); yoksa Tesseract
_omni = None
_omni_available = None


def _check_omnimrz():
    global _omni, _omni_available
    if _omni_available is not None:
        return _omni_available
    try:
        from omnimrz import OmniMRZ
        _omni = OmniMRZ()
        _omni_available = True
        logger.info("OmniMRZ yüklendi (PaddleOCR)")
        return True
    except Exception as e:
        logger.info("OmniMRZ kullanılamıyor, Tesseract kullanılacak: %s", e)
        _omni_available = False
        return False


def _omnimrz_data_to_payload(parsed_data):
    if not parsed_data or not isinstance(parsed_data.get("data"), dict):
        return None
    d = parsed_data["data"]

    def norm_date(s):
        if not s or len(s) != 6:
            return s
        s = (s or "").replace("-", "")[:6]
        if len(s) != 6:
            return d.get("date_of_birth") or ""
        yy, mm, dd = s[0:2], s[2:4], s[4:6]
        y = 2000 + int(yy) if int(yy) < 100 else 1900 + int(yy)
        return f"{y}-{mm}-{dd}"

    return {
        "documentNumber": (d.get("document_number") or "").strip(),
        "birthDate": norm_date((d.get("date_of_birth") or "").replace("-", "")[:6]) or (d.get("date_of_birth") or ""),
        "expiryDate": norm_date((d.get("expiry_date") or "").replace("-", "")[:6]) or (d.get("expiry_date") or ""),
        "surname": (d.get("surname") or "").strip(),
        "givenNames": (d.get("given_names") or "").strip(),
        "issuingCountry": (d.get("issuing_country") or "").strip(),
        "nationality": (d.get("nationality") or "").strip(),
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "python-mrz",
        "engine": "omnimrz" if _check_omnimrz() else "tesseract",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/mrz/process", methods=["POST"])
def process_mrz():
    """
    Body: { "imageBase64": "data:image/jpeg;base64,..." veya "..." }
    """
    try:
        data = request.get_json()
        if not data or "imageBase64" not in data:
            return jsonify({"error": "imageBase64 gerekli"}), 400

        raw = data["imageBase64"]
        if "," in raw:
            raw = raw.split(",", 1)[1]
        image_bytes = base64.b64decode(raw)
        if not image_bytes:
            return jsonify({"error": "Geçersiz base64"}), 400

        # Önce OmniMRZ dene (kuruluysa)
        if _check_omnimrz():
            suffix = ".jpg"
            try:
                Image.open(io.BytesIO(image_bytes))
            except Exception:
                suffix = ".png"
            fd, path = tempfile.mkstemp(suffix=suffix, prefix="mrz_")
            try:
                os.write(fd, image_bytes)
                os.close(fd)
                result = _omni.process(path)
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass

            status = (result.get("extraction") or {}).get("status") or ""
            if "SUCCESS" in status:
                ext = result.get("extraction", {})
                lines = [ext.get("line1"), ext.get("line2"), ext.get("line3")]
                mrz_text = "\n".join(l for l in lines if l)
                parsed = result.get("parsed_data", {})
                mrz_payload = _omnimrz_data_to_payload(parsed)
                return jsonify({
                    "success": True,
                    "extraction": {"line1": ext.get("line1", ""), "line2": ext.get("line2", ""), "line3": ext.get("line3", "")},
                    "mrz": mrz_text,
                    "parsed_data": parsed,
                    "mrzPayload": mrz_payload,
                    "validation": {
                        "structural": (result.get("structural_validation") or {}).get("status", "UNKNOWN"),
                        "checksum": (result.get("checksum_validation") or {}).get("status", "UNKNOWN"),
                        "logical": (result.get("logical_validation") or {}).get("status", "UNKNOWN"),
                    },
                })
            logger.warning("OmniMRZ extraction başarısız, Tesseract deneniyor: %s", status)

        # Tesseract fallback (veya OmniMRZ yoksa tek motor)
        result = read_mrz_from_bytes(image_bytes)
        if result.get("success"):
            return jsonify({
                "success": True,
                "extraction": result.get("extraction", {}),
                "mrz": result.get("mrz", ""),
                "mrzPayload": result.get("mrzPayload"),
                "validation": result.get("validation", {}),
            })
        return jsonify({
            "success": False,
            "error": result.get("error", "MRZ bulunamadı veya okunamadı"),
        }), 400

    except Exception as e:
        logger.exception("MRZ process hatası")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")
