const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("browser launchers include container-safe Chrome sandbox flags", () => {
  const mainPuppeteer = readProjectFile("src/services/puppeteer.ts");
  const serpPuppeteer = readProjectFile("src/services/serp/puppeteer.ts");

  for (const source of [mainPuppeteer, serpPuppeteer]) {
    assert.match(source, /pipe:\s*true/);
    assert.match(source, /--no-sandbox/);
    assert.match(source, /--disable-setuid-sandbox/);
  }
});

test("SERP puppeteer control uses an absolute control timeout instead of a fixed post-navigation race", () => {
  const serpPuppeteer = readProjectFile("src/services/serp/puppeteer.ts");

  assert.match(serpPuppeteer, /waitUntil:\s*\['domcontentloaded', 'load'\]/);
  assert.match(
    serpPuppeteer,
    /setTimeout\(\(\) => \{\s*resultDeferred\.reject\(new TimeoutError/,
  );
  assert.doesNotMatch(serpPuppeteer, /networkidle0/);
  assert.doesNotMatch(serpPuppeteer, /await delay\(5000\)/);
});

test("canvas service falls back when bundled font asset is missing", () => {
  const canvasService = readProjectFile("src/services/canvas.ts");

  assert.match(canvasService, /ENOENT/);
  assert.match(canvasService, /Bundled font asset unavailable/);
});

test("search host includes Google scraping fallback for standalone builds", () => {
  const searcherHost = readProjectFile("src/api/searcher.ts");

  assert.match(searcherHost, /protected googleSerp: GoogleSERP/);
  assert.match(
    searcherHost,
    /protected standaloneFallback: StandaloneSearchFallbackService/,
  );
  assert.match(searcherHost, /yield this\.googleSerp/);
  assert.match(searcherHost, /yield this\.standaloneFallback/);
  assert.match(
    searcherHost,
    /const includeSerper = Boolean\(this\.secretExposer\.SERPER_SEARCH_API_KEY\)/,
  );
});

test("SERP host skips Serper providers when no API key is configured", () => {
  const serpHost = readProjectFile("src/api/serp.ts");

  assert.match(
    serpHost,
    /const includeSerper = Boolean\(this\.secretExposer\.SERPER_SEARCH_API_KEY\)/,
  );
  assert.match(serpHost, /yield this\.standaloneFallback/);
});

test("standalone fallback search provider is available for local web search without private APIs", () => {
  const fallbackProvider = readProjectFile(
    "src/services/serp/standalone-fallback.ts",
  );

  assert.match(fallbackProvider, /DuckDuckGo HTML fallback/i);
  assert.match(
    fallbackProvider,
    /querySelectorAll\('\.result:not\(\.result--ad\)'\)/,
  );
  assert.match(fallbackProvider, /ad_domain/);
});

test("google search provider can fall back to direct requests when no proxy is configured", () => {
  const googleSerp = readProjectFile("src/services/serp/google.ts");

  assert.match(googleSerp, /falling back to direct Google request/i);
});

test("standalone URL validation can allow Docker DNS rewrite ranges behind an explicit env gate", () => {
  const miscService = readProjectFile("src/services/misc.ts");

  assert.match(miscService, /STANDALONE_ALLOW_INTERNAL_DNS_REWRITE/);
  assert.match(miscService, /198\.18/);
  assert.match(miscService, /fd00::/i);
});

test("standalone services use extended boot timeouts for cold starts", () => {
  const bootTimeouts = readProjectFile("src/services/boot-timeouts.ts");
  const crawlHost = readProjectFile("src/api/crawler.ts");
  const searcherHost = readProjectFile("src/api/searcher.ts");
  const serpHost = readProjectFile("src/api/serp.ts");
  const crawlServer = readProjectFile("src/stand-alone/crawl.ts");
  const searchServer = readProjectFile("src/stand-alone/search.ts");
  const serpServer = readProjectFile("src/stand-alone/serp.ts");
  const googleSerp = readProjectFile("src/services/serp/google.ts");

  assert.match(bootTimeouts, /STANDALONE_BOOT_TIMEOUT_MS = 90_000/);
  assert.match(bootTimeouts, /SERP_BOOT_TIMEOUT_MS = 90_000/);
  assert.match(crawlHost, /dependencyReady\(STANDALONE_BOOT_TIMEOUT_MS\)/);
  assert.match(
    crawlHost,
    /override dependencyReady\(timeoutMilliseconds = STANDALONE_BOOT_TIMEOUT_MS\)/,
  );
  assert.match(searcherHost, /dependencyReady\(STANDALONE_BOOT_TIMEOUT_MS\)/);
  assert.match(
    searcherHost,
    /override dependencyReady\(timeoutMilliseconds = STANDALONE_BOOT_TIMEOUT_MS\)/,
  );
  assert.match(serpHost, /dependencyReady\(STANDALONE_BOOT_TIMEOUT_MS\)/);
  assert.match(
    serpHost,
    /override dependencyReady\(timeoutMilliseconds = STANDALONE_BOOT_TIMEOUT_MS\)/,
  );
  assert.match(crawlServer, /dependencyReady\(STANDALONE_BOOT_TIMEOUT_MS\)/);
  assert.match(
    crawlServer,
    /override dependencyReady\(timeoutMilliseconds = STANDALONE_BOOT_TIMEOUT_MS\)/,
  );
  assert.match(searchServer, /dependencyReady\(STANDALONE_BOOT_TIMEOUT_MS\)/);
  assert.match(
    searchServer,
    /override dependencyReady\(timeoutMilliseconds = STANDALONE_BOOT_TIMEOUT_MS\)/,
  );
  assert.match(serpServer, /dependencyReady\(STANDALONE_BOOT_TIMEOUT_MS\)/);
  assert.match(
    serpServer,
    /override dependencyReady\(timeoutMilliseconds = STANDALONE_BOOT_TIMEOUT_MS\)/,
  );
  assert.match(googleSerp, /dependencyReady\(SERP_BOOT_TIMEOUT_MS\)/);
  assert.match(
    googleSerp,
    /override dependencyReady\(timeoutMilliseconds = SERP_BOOT_TIMEOUT_MS\)/,
  );
});
