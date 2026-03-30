# Deploy Xread

This guide deploys the standalone Xread stack behind Caddy with a Compose-compatible container engine.

It assumes you want the common public layout:

- `r.your-domain.example` -> `crawl`
- `s.your-domain.example/search` -> `search`
- `s.your-domain.example/?q=...` -> `serp`

## What Gets Deployed

The stack uses four containers:

- `crawl`: page-to-Markdown service
- `search`: text-oriented web search
- `serp`: structured JSON search
- `caddy`: TLS termination and reverse proxy

Internally, Caddy talks to the HTTP/1 fallback port on each app container.

## Runtime Scope

This deployment layout uses the same image, Compose file, environment variables, and reverse-proxy topology across the common OCI runtimes:

- Docker Engine
- Docker Desktop
- Podman
- `nerdctl` with containerd
- Docker-compatible desktop wrappers such as OrbStack, Colima, and Rancher Desktop

If you need engine-specific command names, see [`container-engines.md`](./container-engines.md).

## Prerequisites

- A Linux server with an OCI-compatible container engine and a Compose-compatible CLI
- DNS records for your subdomains pointing directly at the server
- Ports `80` and `443` reachable from the public internet

> [!IMPORTANT]
> Automatic TLS will not work until your public DNS records really resolve to the server's public IP. Verify that first with a public resolver, not only your local machine cache.

## Files

Use the templates included in this repository:

- [`deploy/docker-compose.yml`](../deploy/docker-compose.yml)
- [`deploy/Caddyfile`](../deploy/Caddyfile)
- [`deploy/.env.example`](../deploy/.env.example)

## 1. Prepare the runtime

Install one supported runtime on the host, then verify that both the engine CLI and the Compose-compatible CLI are available. The deployment steps after this point stay the same.

### Docker

```bash
docker version
docker compose version
```

### Podman

```bash
podman version
podman compose version
```

### nerdctl

```bash
nerdctl version
nerdctl compose version
```

Optional but recommended on very small hosts:

```bash
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Copy the deployment assets

```bash
mkdir -p /opt/xread
cd /opt/xread
```

Copy these files into `/opt/xread`:

- `docker-compose.yml`
- `Caddyfile`
- `.env`

Start from the repository template:

```bash
cp deploy/.env.example /opt/xread/.env
```

Choose the Compose-compatible command you plan to use:

```bash
# Docker / Docker Desktop / OrbStack / Colima
export COMPOSE_CMD="docker compose"

# Podman
export COMPOSE_CMD="podman compose"

# nerdctl
export COMPOSE_CMD="nerdctl compose"
```

## 3. Configure environment variables

Edit `/opt/xread/.env`:

```dotenv
R_HOST=r.your-domain.example
S_HOST=s.your-domain.example
ACME_EMAIL=ops@your-domain.example
XREAD_IMAGE=ghcr.io/xixu-me/xread:latest
PUBLIC_HTTP_PORT=80
PUBLIC_HTTPS_PORT=443
XREAD_LOOPBACK_HOST=127.0.0.1
XREAD_CRAWL_LOOPBACK_PORT=3001
XREAD_SEARCH_LOOPBACK_PORT=3101
XREAD_SERP_LOOPBACK_PORT=3201
SERPER_SEARCH_API_KEY=
BRAVE_SEARCH_API_KEY=
LOCAL_PROXY_URLS=
```

Notes:

- `PUBLIC_HTTP_PORT` and `PUBLIC_HTTPS_PORT` default to `80` and `443`
- If your host or policy does not allow binding `80` and `443`, change those to higher ports such as `8080` and `8443`
- `XREAD_LOOPBACK_HOST` and the three backend loopback ports control the local operator-only smoke-test endpoints
- `SERPER_SEARCH_API_KEY` is optional but recommended for more stable Google/Bing search results
- `BRAVE_SEARCH_API_KEY` is optional
- `LOCAL_PROXY_URLS` is optional and can stay empty
- Other runtime variables exist, but this template keeps the deployment file focused on the common deployment subset

## 4. Start the stack

```bash
cd /opt/xread
$COMPOSE_CMD pull
$COMPOSE_CMD up -d
```

Check status:

```bash
$COMPOSE_CMD ps
$COMPOSE_CMD logs --tail=100
```

On small VPS instances, give the stack a little time on first boot. Chrome-based workers can take tens of seconds to warm up.

## 5. Verify the deployment

There are three useful checkpoints:

- direct loopback checks against the three backend containers
- public-domain checks through Caddy
- temporary `--resolve` checks before public DNS is live

### Local container checks

These examples use the default loopback values from `deploy/.env.example`:

```bash
curl http://127.0.0.1:3001/http://example.com
curl "http://127.0.0.1:3101/search?q=example%20domain&num=3&provider=google"
curl "http://127.0.0.1:3201/?q=example%20domain&num=3&provider=google"
```

Those loopback ports are published only on `XREAD_LOOPBACK_HOST` for operator smoke tests. They are not exposed publicly unless you change that host binding yourself.

### Public domain checks

These examples assume the default public ports `80` and `443`:

```bash
curl https://r.your-domain.example/http://example.com
curl "https://s.your-domain.example/search?q=example%20domain&num=3&provider=google"
curl "https://s.your-domain.example/?q=example%20domain&num=3&provider=google"
```

If DNS is not live yet, you can still smoke-test the reverse proxy path from a client machine:

```bash
curl --resolve r.your-domain.example:80:YOUR_SERVER_IP -H "Host: r.your-domain.example" http://r.your-domain.example/http://example.com
curl --resolve s.your-domain.example:80:YOUR_SERVER_IP -H "Host: s.your-domain.example" "http://s.your-domain.example/search?q=example%20domain&num=3&provider=google"
```

## Operational Notes

- The app containers store data under named volumes for `storage` and `db`
- Caddy stores certificates and config in named volumes
- The image already contains Chrome and common font packages
- Public traffic terminates at Caddy; app containers stay on the internal Compose network

## Upgrade

```bash
cd /opt/xread
$COMPOSE_CMD pull
$COMPOSE_CMD up -d
```

For safer upgrades, pin `XREAD_IMAGE` to a digest instead of `latest`.

## Troubleshooting

### TLS does not issue

Usually means one of:

- DNS is not pointing at the server yet
- Port `80` or `443` is blocked
- Another process is already listening on those ports

### The host cannot bind 80 or 443

Use the same deployment knobs regardless of engine:

- set `PUBLIC_HTTP_PORT` and `PUBLIC_HTTPS_PORT` to higher ports such as `8080` and `8443`
- terminate TLS on an external load balancer if you want to keep public `443`
- forward `80` and `443` from another service if your host standard requires it

### Search works poorly without an API key

That is expected. The standalone fallback path is useful for bootstrapping and low-volume use, but provider-backed search is more stable.

### Browser rendering fails on small hosts

Make sure swap is enabled and the host is not memory-starved. The image includes Chrome, so low-memory VPS instances can benefit from at least `1G` swap.
