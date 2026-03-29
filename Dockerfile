# syntax=docker/dockerfile:1
FROM node:25-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends wget gnupg ca-certificates \
    && mkdir -p /etc/apt/keyrings \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 zstd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY integrity-check.cjs tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY licensed ./licensed

RUN npm run build
RUN NODE_ENV=dry-run node ./build/stand-alone/crawl.js \
    && NODE_ENV=dry-run node ./build/stand-alone/search.js \
    && NODE_ENV=dry-run node ./build/stand-alone/serp.js

RUN groupadd -r xread \
    && useradd -g xread -G audio,video -m xread \
    && chown -R xread:xread /app

USER xread

ENV OVERRIDE_CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_COMPILE_CACHE=node_modules
ENV PORT=8080

EXPOSE 3000 3001 8080 8081
ENTRYPOINT ["node"]
CMD ["build/stand-alone/crawl.js"]
