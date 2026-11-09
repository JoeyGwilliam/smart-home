FROM node:26-slim AS build

WORKDIR /app

# Installing dependencies before copying the source means that a source change doesn't reinstall them on every build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# The unprivileged image runs nginx as a non-root user, which is why it listens on 8080 rather than 80.
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/"]
