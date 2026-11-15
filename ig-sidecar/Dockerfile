# syntax=docker/dockerfile:1

# ---- build ----
# Wheels are built here so the runtime image carries no compiler.
FROM python:3.12-slim AS build
WORKDIR /wheels
COPY requirements.txt ./
RUN pip wheel --wheel-dir /wheels -r requirements.txt

# ---- run ----
FROM python:3.12-slim AS run
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    IG_SESSIONS_DIR=/data/sessions

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app

COPY --from=build /wheels /wheels
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /tmp/requirements.txt \
    && rm -rf /wheels /tmp/requirements.txt

WORKDIR /app
COPY main.py ./

# instagrapi settings blobs and the per-account guard state live here; the
# volume mounted over it inherits this ownership.
RUN mkdir -p /data/sessions && chown -R app:app /data

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
