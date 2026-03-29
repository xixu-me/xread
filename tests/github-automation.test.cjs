const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('legacy Cloud Run deployment workflow has been removed', () => {
  const legacyWorkflow = path.join(projectRoot, '.github', 'workflows', 'cd.yml');

  assert.equal(fs.existsSync(legacyWorkflow), false);
});

test('repository automation files exist for CI, container publish, and Dependabot', () => {
  const expectedFiles = [
    '.eslintrc.cjs',
    '.eslintignore',
    '.github/workflows/ci.yml',
    '.github/workflows/image.yml',
    '.github/workflows/dependabot-auto-merge.yml',
    '.github/dependabot.yml',
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, `${relativePath} should exist`);
  }
});

test('container image workflow publishes to GHCR instead of legacy GCP registries', () => {
  const workflow = read('.github/workflows/image.yml');

  assert.match(workflow, /ghcr\.io/);
  assert.doesNotMatch(workflow, /gcloud|us-docker\.pkg\.dev/);
});

test('dependabot config covers npm, docker, and github-actions updates', () => {
  const dependabot = read('.github/dependabot.yml');

  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: docker/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});

test('CI workflow runs lint before tests and build', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npm run test:ci/);
  assert.match(workflow, /run: npm run build/);
});

test('Dockerfile is self-contained and no longer relies on curl-impersonate', () => {
  const dockerfile = read('Dockerfile');

  assert.match(dockerfile, /FROM node:22-bookworm-slim/);
  assert.match(dockerfile, /PUPPETEER_SKIP_DOWNLOAD=true/);
  assert.doesNotMatch(dockerfile, /curl-impersonate|LD_PRELOAD/);
});
