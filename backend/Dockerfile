# syntax=docker/dockerfile:1

# ---- build ----
FROM golang:1.25-alpine AS build
WORKDIR /src

# The module has no third-party dependencies (stdlib only), so this is just the
# two files; it still earns a cached layer.
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOFLAGS=-trimpath go build -ldflags='-s -w' -o /out/server ./cmd/server

# ---- run ----
# Alpine rather than distroless: compose needs a healthcheck command inside the
# container, and `wget` is the cheapest way to have one.
FROM alpine:3.21 AS run
RUN adduser -D -u 10001 app

# Created here so the named volumes mounted over them inherit the right owner —
# the server writes session and snapshot files at runtime.
RUN mkdir -p /data/sessions /data/snapshots && chown -R app:app /data

COPY --from=build /out/server /usr/local/bin/server

USER app
WORKDIR /data
ENV PORT=8080 \
    SESSION_DIR=/data/sessions \
    SNAPSHOT_DIR=/data/snapshots
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

CMD ["server"]
