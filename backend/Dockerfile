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

ENV DSFC_PROVIDER_VENV_ROOT=/opt/provider-venvs \
    HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    ALL_PROXY=${ALL_PROXY} \
    NO_PROXY=${NO_PROXY} \
    http_proxy=${HTTP_PROXY} \
    https_proxy=${HTTPS_PROXY} \
    all_proxy=${ALL_PROXY} \
    no_proxy=${NO_PROXY} \
    PIP_DEFAULT_TIMEOUT=120

COPY pyproject.toml README.md ./
COPY app ./app
COPY scripts ./scripts
COPY vendor ./vendor

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && if [ -n "$BACKEND_EXTRAS" ]; then python -m pip install --no-cache-dir ".[${BACKEND_EXTRAS}]"; else python -m pip install --no-cache-dir .; fi \
    && mkdir -p "${DSFC_PROVIDER_VENV_ROOT}" \
    && if [ "$INSTALL_STRATEGY_PROVIDERS" = "1" ] && [ -d ./vendor/strategy_providers/rdagent ]; then \
         python -m pip install --no-cache-dir -e ./vendor/strategy_providers/rdagent \
         && python -m venv --system-site-packages "${DSFC_PROVIDER_VENV_ROOT}/rdagent" \
         && "${DSFC_PROVIDER_VENV_ROOT}/rdagent/bin/pip" install --no-cache-dir "openai==2.30.0" \
         && "${DSFC_PROVIDER_VENV_ROOT}/rdagent/bin/pip" install --no-cache-dir --no-deps -e ./vendor/strategy_providers/rdagent; \
       fi \
    && if [ "$INSTALL_STRATEGY_PROVIDERS" = "1" ] && [ -d ./vendor/strategy_providers/tradingagents_cn ]; then \
         python -m pip install --no-cache-dir -e ./vendor/strategy_providers/tradingagents_cn \
         && python -m venv --system-site-packages "${DSFC_PROVIDER_VENV_ROOT}/tradingagents_cn" \
         && "${DSFC_PROVIDER_VENV_ROOT}/tradingagents_cn/bin/pip" install --no-cache-dir --no-deps -e ./vendor/strategy_providers/tradingagents_cn; \
       fi

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD python -c "import sys, urllib.request; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/health').status == 200 else sys.exit(1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
