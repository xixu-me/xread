const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");

test("src/shared is a real directory in the repository", () => {
  const sharedPath = path.join(projectRoot, "src", "shared");
  const stat = fs.statSync(sharedPath);

  assert.equal(stat.isDirectory(), true);
});

test("default build script uses standard TypeScript compiler", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );

  assert.equal(packageJson.packageManager, "bun@1.3.11");
  assert.match(packageJson.scripts.build, /\btsc\b/);
  assert.doesNotMatch(packageJson.scripts.build, /scripts\/transpile\.cjs/);
});

test("repository metadata and scripts are Bun-first", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
  const legacyLockfileName = ["package", "lock.json"].join("-");

  assert.equal(fs.existsSync(path.join(projectRoot, "bun.lock")), true);
  assert.equal(
    fs.existsSync(path.join(projectRoot, legacyLockfileName)),
    false,
  );
  assert.match(packageJson.scripts["test:ci"], /^bun test --timeout 120000 /);
  assert.equal(packageJson.scripts.serve, "bun run build && bun run start");
  assert.equal(
    packageJson.scripts.debug,
    "bun run build && bun --inspect ./build/stand-alone/crawl.js",
  );
  assert.equal(packageJson.scripts.start, "bun ./build/stand-alone/crawl.js");
  assert.equal(
    packageJson.scripts["dry-run"],
    "NODE_ENV=dry-run bun ./build/stand-alone/search.js",
  );
});

test("project type-check build passes with tsc", () => {
  const tscJsPath = path.join(
    projectRoot,
    "node_modules",
    "typescript",
    "lib",
    "tsc.js",
  );
  const result = spawnSync(
    process.execPath,
    [tscJsPath, "-p", ".", "--pretty", "false"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      shell: false,
    },
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
});
