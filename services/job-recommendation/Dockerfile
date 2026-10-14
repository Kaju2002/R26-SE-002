FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Data paths in src/ are relative (data/raw/jobs.csv), so run from the service root.
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Railway injects PORT; Hugging Face Spaces uses app_port from README (8002); local default 8002.
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8002}"]
