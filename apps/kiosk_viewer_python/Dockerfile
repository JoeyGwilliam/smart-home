FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH"

# Installing dependencies before copying the source means that a source change doesn't reinstall them on every build.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

RUN useradd --create-home kiosk
USER kiosk

EXPOSE 8080

# Checks a static file because the viewer is healthy even while the reminders API is down, when it shows a friendly page.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/static/style.css', timeout=2)"]

CMD ["uvicorn", "kiosk_viewer_python.create_app:create_app_from_environment", "--factory", "--host", "0.0.0.0", "--port", "8080"]
