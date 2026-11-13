FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH"

# Installing dependencies before copying the source means that a source change doesn't reinstall them on every build.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

# Created here so that a new named volume mounted at /data inherits this ownership.
RUN useradd --create-home recipes && mkdir /data && chown recipes /data
USER recipes

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/openapi.json', timeout=2)"]

CMD ["uvicorn", "recipes_api.api.create_app:create_app_from_environment", "--factory", "--host", "0.0.0.0", "--port", "8000"]
