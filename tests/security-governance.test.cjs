const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("package.json exposes the security audit script and excludes removed cloud dependencies", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(
    packageJson.scripts["security:audit"],
    "bun ./scripts/security-audit-report.cjs",
  );
  assert.match(
    packageJson.scripts["test:ci"],
    /tests\/security-governance\.test\.cjs/,
  );
  assert.ok(!("@google-cloud/translate" in packageJson.dependencies));
  assert.ok(!("express" in packageJson.dependencies));
  assert.ok(!("firebase-admin" in packageJson.dependencies));
  assert.ok(!("firebase-functions" in packageJson.dependencies));
  assert.ok(!("firebase-functions-test" in packageJson.devDependencies));
  assert.ok(!("openai" in packageJson.dependencies));
  assert.ok(!("replicate" in packageJson.devDependencies));
});

test("security governance workflow enforces Bun audit policy and uploads reports", () => {
  const workflow = read(".github/workflows/security-governance.yml");

  assert.match(workflow, /name:\s+Security Governance/);
  assert.match(workflow, /name:\s+Enforce Bun audit policy/);
  assert.match(workflow, /oven-sh\/setup-bun@v\d+/);
  assert.match(workflow, /run:\s+bun install --frozen-lockfile/);
  assert.match(workflow, /run:\s+bun run security:audit/);
  assert.match(workflow, /actions\/upload-artifact@v\d+/);
  assert.match(workflow, /cron:\s+["']31 17 \* \* 1["']/);
  assert.match(workflow, /name:\s+security-bun-audit-report/);
});

test("security baseline file is present and ready for future exceptions", () => {
  const baseline = JSON.parse(read("security/bun-audit-baseline.json"));

  assert.ok(Array.isArray(baseline.entries));
  assert.equal(baseline.entries.length, 0);
});
