# syntax=docker/dockerfile:1
FROM debian:bookworm-slim

ARG BUN_VERSION=1.3.11

ENV BUN_VERSION=${BUN_VERSION}
ENV BUN_INSTALL=/opt/bun
ENV PATH="${BUN_INSTALL}:${PATH}"
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip wget gnupg ca-certificates \
    && curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip" -o /tmp/bun.zip \
    && unzip /tmp/bun.zip -d /opt \
    && mv /opt/bun-linux-x64 "${BUN_INSTALL}" \
    && ln -sf "${BUN_INSTALL}/bun" /usr/local/bin/bun \
    && mkdir -p /etc/apt/keyrings \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 zstd \
    && rm -rf /var/lib/apt/lists/* /tmp/bun.zip

RUN groupadd -r xread \
    && useradd -g xread -G audio,video -m xread

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY integrity-check.cjs tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY licensed ./licensed

RUN bun run build
RUN NODE_ENV=dry-run bun ./build/stand-alone/crawl.js \
    && NODE_ENV=dry-run bun ./build/stand-alone/search.js \
    && NODE_ENV=dry-run bun ./build/stand-alone/serp.js

USER xread

ENV LOCAL_DB_ROOT=/tmp/xread/db
ENV OVERRIDE_CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PORT=8080
ENV STORAGE_ROOT=/tmp/xread/storage
ENV STANDALONE_ALLOW_INTERNAL_DNS_REWRITE=true

EXPOSE 3000 3001 8080 8081
ENTRYPOINT ["bun"]
CMD ["build/stand-alone/crawl.js"]
