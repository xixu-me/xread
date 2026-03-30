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
    '.github/workflows/codeql.yml',
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

test('container image publishing waits for CI instead of running on pull requests directly', () => {
  const workflow = read('.github/workflows/image.yml');

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\n\s*- CI/);
  assert.doesNotMatch(workflow, /pull_request:/);
});

test('workflows opt into Node 24 for JavaScript-based GitHub Actions', () => {
  const workflows = [
    read('.github/workflows/ci.yml'),
    read('.github/workflows/codeql.yml'),
    read('.github/workflows/image.yml'),
    read('.github/workflows/dependabot-auto-merge.yml'),
  ];

  for (const workflow of workflows) {
    assert.match(workflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/);
  }
});

test('CodeQL workflow uses advanced setup with repository-managed configuration', () => {
  const workflow = read('.github/workflows/codeql.yml');

  assert.match(workflow, /uses:\s*actions\/checkout@v5/);
  assert.match(workflow, /uses:\s*github\/codeql-action\/init@v4/);
  assert.match(workflow, /uses:\s*github\/codeql-action\/analyze@v4/);
  assert.match(workflow, /language:\s*actions/);
  assert.match(workflow, /language:\s*javascript-typescript/);
});

test('dependabot config covers npm, docker, and github-actions updates', () => {
  const dependabot = read('.github/dependabot.yml');

  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: docker/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});

test('dependabot ignores unsupported major upgrades for koa and docker base images', () => {
  const dependabot = read('.github/dependabot.yml');

  assert.match(dependabot, /dependency-name:\s*koa/);
  assert.match(dependabot, /update-types:\s*\n\s*- version-update:semver-major/);
  assert.match(dependabot, /dependency-name:\s*node/);
});

test('CI workflow runs lint before tests and build', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npm run test:ci/);
  assert.match(workflow, /run: npm run build/);
});

test('CI validates Docker builds for pull requests without publishing images', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /name: Validate container build/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /push: false/);
});

test('dependabot auto-merge workflow updates stale branches before enabling auto-merge', () => {
  const workflow = read('.github/workflows/dependabot-auto-merge.yml');

  assert.match(workflow, /gh pr update-branch/);
  assert.match(workflow, /mergeStateStatus/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\n\s*- CI/);
  assert.match(workflow, /gh pr list/);
});

test('Dockerfile is self-contained and no longer relies on curl-impersonate', () => {
  const dockerfile = read('Dockerfile');

  assert.match(dockerfile, /FROM node:22-bookworm-slim/);
  assert.match(dockerfile, /PUPPETEER_SKIP_DOWNLOAD=true/);
  assert.match(dockerfile, /LOCAL_DB_ROOT=\/tmp\/xread\/db/);
  assert.match(dockerfile, /STORAGE_ROOT=\/tmp\/xread\/storage/);
  assert.doesNotMatch(dockerfile, /chown -R xread:xread \/app/);
  assert.doesNotMatch(dockerfile, /curl-impersonate|LD_PRELOAD/);
});
