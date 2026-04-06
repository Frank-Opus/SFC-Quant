FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG BACKEND_EXTRAS=""
ARG INSTALL_STRATEGY_PROVIDERS="0"
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG ALL_PROXY=""
ARG NO_PROXY=""

WORKDIR /app

COPY pyproject.toml README.md ./
COPY app ./app
COPY scripts ./scripts
COPY vendor ./vendor

RUN python -m pip install --no-cache-dir --upgrade pip \
    && if [ -n "$BACKEND_EXTRAS" ]; then python -m pip install --no-cache-dir ".[${BACKEND_EXTRAS}]"; else python -m pip install --no-cache-dir .; fi \
    && if [ "$INSTALL_STRATEGY_PROVIDERS" = "1" ]; then \
         if [ -d ./vendor/strategy_providers/rdagent ]; then python -m pip install --no-cache-dir -e ./vendor/strategy_providers/rdagent; fi; \
         if [ -d ./vendor/strategy_providers/tradingagents_cn ]; then python -m pip install --no-cache-dir -e ./vendor/strategy_providers/tradingagents_cn; fi; \
       fi

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD python -c "import sys, urllib.request; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/health').status == 200 else sys.exit(1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
