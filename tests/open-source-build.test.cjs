const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

test('src/shared is a real directory in the repository', () => {
  const sharedPath = path.join(projectRoot, 'src', 'shared');
  const stat = fs.statSync(sharedPath);

  assert.equal(stat.isDirectory(), true);
});

test('default build script uses standard TypeScript compiler', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

  assert.match(packageJson.scripts.build, /\btsc\b/);
  assert.doesNotMatch(packageJson.scripts.build, /scripts\/transpile\.cjs/);
});

test('project type-check build passes with tsc', () => {
  const tscJsPath = path.join(
    projectRoot,
    '.codex-cache',
    'ts-compiler',
    'node_modules',
    'typescript',
    'lib',
    'tsc.js',
  );
  const result = spawnSync(
    process.execPath,
    [tscJsPath, '-p', '.', '--pretty', 'false'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      shell: false,
    },
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
});
