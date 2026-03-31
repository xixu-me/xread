# Xread

**_[汉语](./README.zh.md)_**

**Your LLMs deserve better input.**

Turn messy webpages into clean Markdown, run web search for LLMs, and self-host the whole stack.

Xread is an open-source, self-hosted web ingestion service for LLM workflows. It gives you three main surfaces:

- `crawl`: fetch a URL and turn it into readable Markdown
- `search`: run a search and return text that is easy to paste into a prompt
- `serp`: run a search and return structured JSON

It is a standalone fork of the public [Jina AI Reader](https://jina.ai/reader) repository in [`jina-ai/reader`](https://github.com/jina-ai/reader), adapted for self-hosted use without the original internal `thinapps-shared` dependency.

## What This Repository Adds

- Self-hosted packaging around the upstream Reader repository
- Local-first storage and cache persistence
- Bun-first contributor tooling across local development, CI, and containers
- OCI image published to GHCR
- Ready-to-run reverse-proxy deployment assets with the same image, Compose stack, and environment model across Docker, Podman, and `nerdctl`
- CI, CodeQL, dependency governance, and container publishing already wired up

## Quick Look

These examples use the published image directly on its HTTP/1 port (`8081`). The deployment guide later covers the Compose backend loopback ports (`3001`, `3101`, `3201`) and the public reverse-proxy hostnames.

### Crawl a page

```bash
curl "http://127.0.0.1:8081/http://example.com"
```

### Search the web as text

```bash
curl "http://127.0.0.1:8081/search?q=example%20domain&num=5&provider=google"
```

### Search the web as JSON

```bash
curl "http://127.0.0.1:8081/?q=example%20domain&num=5&provider=google"
```

## Quick Start

### Run locally

```bash
bun install --frozen-lockfile
bun run build
bun run start
```

That starts the `crawl` server. The standalone services are:

- `build/stand-alone/crawl.js`
- `build/stand-alone/search.js`
- `build/stand-alone/serp.js`

### Run with a container engine

```bash
docker run --rm --publish=8081:8081 ghcr.io/xixu-me/xread:latest
```

The published image defaults to `crawl`. Any OCI-compatible engine can run it. The examples below use Docker syntax. To run the other entrypoints:

```bash
docker run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/search.js
docker run --rm --publish=8081:8081 --entrypoint bun ghcr.io/xixu-me/xread:latest build/stand-alone/serp.js
```

If you need to expose more than one port from the container, prefer repeating the long-form flag, for example `--publish=8080:8080 --publish=8081:8081`.

## Built for Self-Hosting

- Chrome is bundled in the image for page rendering
- HTTP/2 cleartext (`h2c`) is supported internally
- HTTP/1 fallback is available on `PORT + 1`
- If no paid search provider is configured, `search` and `serp` still work through the standalone fallback path

Published image:

- `ghcr.io/xixu-me/xread:latest`

For production, pin a digest instead of following `latest`.

## Deploy It

The repository includes a complete reverse-proxy deployment example:

- [Deployment guide](./docs/deploy.md)
- [Container engine guide](./docs/container-engines.md)
- [Compose stack](./deploy/docker-compose.yml)
- [`Caddyfile`](./deploy/Caddyfile)
- [Environment template](./deploy/.env.example)

The deployment docs use the same image, Compose stack, and environment variables across Docker, Podman, and `nerdctl`/containerd.

The documented deployment pattern is:

- `r.your-domain.example` -> `crawl`
- `s.your-domain.example/search` -> `search`
- `s.your-domain.example/?q=...` -> `serp`

## Configuration

The standalone build reads configuration from environment variables.

The deployment template in [`deploy/.env.example`](./deploy/.env.example) includes the shared deployment variables. The full runtime surface is:

| Variable                          | Purpose                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `PORT`                            | Main service port. HTTP/1 fallback listens on `PORT + 1`.                   |
| `PUBLIC_HTTP_PORT`                | Public HTTP port exposed by the reverse proxy in the Compose deployment.    |
| `PUBLIC_HTTPS_PORT`               | Public HTTPS port exposed by the reverse proxy in the Compose deployment.   |
| `XREAD_LOOPBACK_HOST`             | Host IP used for the backend loopback ports in the Compose deployment.      |
| `XREAD_CRAWL_LOOPBACK_PORT`       | Host loopback port for the `crawl` backend.                                 |
| `XREAD_SEARCH_LOOPBACK_PORT`      | Host loopback port for the `search` backend.                                |
| `XREAD_SERP_LOOPBACK_PORT`        | Host loopback port for the `serp` backend.                                  |
| `STORAGE_ROOT`                    | Root directory for stored artifacts such as snapshots and generated assets. |
| `LOCAL_DB_ROOT`                   | Root directory for local metadata, caches, and lightweight persistence.     |
| `SERPER_SEARCH_API_KEY`           | Enables Serper-backed Google/Bing search.                                   |
| `BRAVE_SEARCH_API_KEY`            | Enables Brave Search integration where supported.                           |
| `CLOUD_FLARE_API_KEY`             | Enables Cloudflare-backed capabilities where configured.                    |
| `LOCAL_PROXY_URLS`                | Optional proxy pool for outbound requests.                                  |
| `OVERRIDE_CHROME_EXECUTABLE_PATH` | Optional override for the Chrome executable path.                           |

Useful request controls for crawling include:

- `x-no-cache`
- `x-target-selector`
- `x-wait-for-selector`
- `x-respond-with`
- `x-timeout`

## Build and Verify

```bash
bun run lint
bun run security:audit
bun run test:ci
bun run build
```

The image build also dry-runs all three standalone servers.

## Repository Layout

```text
src/api/           RPC hosts and public HTTP-facing methods
src/stand-alone/   standalone server entrypoints
src/services/      crawling, formatting, search, and runtime services
src/shared/        local shared primitives for storage, rate limits, and config
public/            static assets
deploy/            ready-to-run production deployment templates
docs/              operational documentation
scripts/           build, licensing, and security helper scripts
tests/             regression tests for build, runtime, and automation
```
