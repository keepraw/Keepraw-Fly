FROM caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
ARG VERSION=0.1.1
ARG REVISION
LABEL org.opencontainers.image.title="Keepraw-Fly" \
      org.opencontainers.image.authors="keepraw" \
      org.opencontainers.image.source="https://github.com/keepraw/Keepraw-Fly" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.licenses="MIT"
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY apps/web/dist/ /srv/
ENV SITE_ADDRESS=:80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 \
  CMD wget -Y off -q -O /dev/null http://127.0.0.1:8081/health || exit 1
