const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('integrity check warns instead of failing when GeoLite asset is missing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xread-integrity-'));
  const scriptPath = path.join(tempRoot, 'integrity-check.cjs');

  fs.copyFileSync(path.resolve(__dirname, '..', 'integrity-check.cjs'), scriptPath);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: tempRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stderr, /GeoLite2-City\.mmdb/);
});
