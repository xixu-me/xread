# Container Engine Guide

Xread ships as a standard OCI image and a Compose stack. Docker, Podman, and `nerdctl` all use the same image, the same `deploy/docker-compose.yml`, the same environment variables, and the same reverse-proxy layout.

## Server Runtimes

| Runtime                   | Single container | Compose stack | Notes                                   |
| ------------------------- | ---------------- | ------------- | --------------------------------------- |
| Docker Engine             | Yes              | Yes           | Use `docker run` and `docker compose`   |
| Podman                    | Yes              | Yes           | Use `podman run` and `podman compose`   |
| containerd with `nerdctl` | Yes              | Yes           | Use `nerdctl run` and `nerdctl compose` |

## Desktop Wrappers

| Environment     | Single container | Compose stack | Notes                                                                            |
| --------------- | ---------------- | ------------- | -------------------------------------------------------------------------------- |
| Docker Desktop  | Yes              | Yes           | Same commands as Docker Engine                                                   |
| OrbStack        | Yes              | Yes           | Docker-compatible CLI                                                            |
| Colima          | Yes              | Yes           | Docker-compatible CLI after `docker context` is configured                       |
| Rancher Desktop | Yes              | Yes           | Use either Docker-compatible CLI or `nerdctl`, depending on how it is configured |

> [!NOTE]
> The deployment files in [`deploy`](../deploy) stay named `docker-compose.yml` because that filename is still the broadest common denominator across Compose-compatible tooling.

## Single-Container Commands

### Docker-compatible CLIs

These examples work unchanged with:

- Docker Engine
- Docker Desktop
- OrbStack
- Colima with Docker context enabled

```bash
docker run --rm --publish=8081:8081 ghcr.io/xixu-me/xread:latest
docker run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/search.js
docker run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/serp.js
```

When you need to expose multiple ports, prefer repeating the long-form publish flag, for example `--publish=8080:8080 --publish=8081:8081`.

### Podman

```bash
podman run --rm --publish=8081:8081 ghcr.io/xixu-me/xread:latest
podman run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/search.js
podman run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/serp.js
```

### nerdctl

```bash
nerdctl run --rm --publish=8081:8081 ghcr.io/xixu-me/xread:latest
nerdctl run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/search.js
nerdctl run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/serp.js
```

## Compose Commands

The stack in [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) works with Compose-compatible CLIs. All engines use the same file and the same variables from [`deploy/.env.example`](../deploy/.env.example).

### Docker / Docker Desktop / OrbStack / Colima

```bash
docker compose pull
docker compose up -d
docker compose ps
```

### Podman

```bash
podman compose pull
podman compose up -d
podman compose ps
```

### nerdctl

```bash
nerdctl compose pull
nerdctl compose up -d
nerdctl compose ps
```

## Shared Deployment Knobs

The deployment model stays the same across engines:

- `PUBLIC_HTTP_PORT` and `PUBLIC_HTTPS_PORT` control the reverse-proxy entrypoints
- `XREAD_LOOPBACK_HOST` controls whether backend smoke-test ports stay on loopback
- `XREAD_CRAWL_LOOPBACK_PORT`, `XREAD_SEARCH_LOOPBACK_PORT`, and `XREAD_SERP_LOOPBACK_PORT` control the three backend check ports
- `R_HOST`, `S_HOST`, and `ACME_EMAIL` control the public reverse-proxy hostnames and certificate email

If your host cannot publish `80` and `443`, use the same fix regardless of engine: set `PUBLIC_HTTP_PORT` and `PUBLIC_HTTPS_PORT` to higher ports, or terminate TLS before the stack.

## Practical Recommendation

Choose the engine that matches your host standard:

- Docker Engine
- Podman
- `nerdctl` on containerd

For local development, Docker Desktop, OrbStack, Colima, and Rancher Desktop all work with the same image and Compose stack.
