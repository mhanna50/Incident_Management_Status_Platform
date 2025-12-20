FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1 \
  DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

RUN apt-get update && \
  apt-get install -y --no-install-recommends build-essential python3-dev libffi-dev libev-dev cython3 && \
  rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-class", "gevent", "--timeout", "0"]
