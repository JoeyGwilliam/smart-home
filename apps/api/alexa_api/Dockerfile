FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv

WORKDIR /app
# compose.yaml makes the container's files read-only, so Python must not try to save compiled files as it runs.
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1

# Installing dependencies before copying the source means that a source change doesn't reinstall them on every build.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

RUN useradd --create-home alexa
USER alexa

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]

CMD ["uvicorn", "alexa_api.api.create_app:create_app_from_environment", "--factory", "--host", "0.0.0.0", "--port", "8000"]
