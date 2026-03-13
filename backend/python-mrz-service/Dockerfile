# OmniMRZ (PaddleOCR) için Python servisi
FROM python:3.11-slim

WORKDIR /app

# PaddleOCR / OpenCV sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# OmniMRZ PaddleOCR bağımlılıkları (omnimrz kurulumunda gelir; gerekirse açık kur)
RUN pip install --no-cache-dir paddlepaddle paddleocr 2>/dev/null || true

COPY . .
RUN mkdir -p /app/cache

EXPOSE 5001
ENV FLASK_ENV=production
CMD ["python", "app.py"]
