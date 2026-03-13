# Python MRZ Servisi

Belge görsellerinden MRZ okuma için Flask servisi. **OmniMRZ (Paddle)** kuruluysa onu kullanır; kurulu değilse (örn. Python 3.14 veya Windows’ta Paddle yok) **Tesseract** ile çalışır. Backend `/api/ocr/document-base64` önce bu servisi dener.

## Gereksinimler

- **Tesseract OCR** sistemde kurulu olmalı ve PATH’te olmalı (veya `pytesseract.pytesseract.tesseract_cmd` ayarlanmalı). İndirme: https://github.com/UB-Mannheim/tesseract/wiki
- Paddle/OmniMRZ isteğe bağlı (Python 3.8–3.11 + uyumlu platformda `pip install omnimrz` ile deneyebilirsiniz).

## Lokal çalıştırma

```bash
cd backend/python-mrz-service
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Servis `http://localhost:5001` üzerinde çalışır. Tesseract kurulu değilse OCR hatası alırsınız; önce Tesseract’i kurun.

- `GET /health` — sağlık kontrolü
- `POST /mrz/process` — body: `{ "imageBase64": "..." }`

## Ortam değişkenleri

- `PYTHON_MRZ_URL` — Node backend için (örn. `http://localhost:5001` veya Docker'da `http://python-mrz:5001`)
- `FLASK_DEBUG` — true ise debug modu

## Docker

```bash
cd backend
docker-compose up --build
```

Node backend `8080`, Python MRZ `5001` portunda çalışır.
