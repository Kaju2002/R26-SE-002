FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# CPU-only torch first — the default Linux wheel bundles ~3 GB of unused CUDA libraries.
COPY requirements.txt .
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install -r requirements.txt

COPY . .

# Railway injects PORT; fall back to 8003 for local `docker run`.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8003}"]
