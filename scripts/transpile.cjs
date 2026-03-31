#!/usr/bin/env bun

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const os = require("node:os");

const projectRoot = path.resolve(__dirname, "..");
const tsconfigPath = path.join(projectRoot, "tsconfig.json");
const bootstrapRoot = path.join(projectRoot, ".codex-cache", "ts-compiler");
const bootstrapPrefix = path.join(bootstrapRoot, "workspace");
const bootstrapPackageJsonPath = path.join(bootstrapPrefix, "package.json");

function resolveTypeScript() {
  const candidatePaths = [
    path.join(projectRoot, "node_modules", "typescript"),
    path.join(bootstrapPrefix, "node_modules", "typescript"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  ensureDir(bootstrapPrefix);
  fs.writeFileSync(
    bootstrapPackageJsonPath,
    JSON.stringify({ name: "ts-compiler-bootstrap", private: true }, null, 2) +
      "\n",
  );
  const install = childProcess.spawnSync(
    "bun",
    [
      "install",
      "--cwd",
      bootstrapPrefix,
      "--no-save",
      "--ignore-scripts",
      "typescript@5.5.4",
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        BUN_INSTALL_CACHE_DIR: path.join(bootstrapRoot, "cache"),
        TMPDIR: os.tmpdir(),
        TEMP: os.tmpdir(),
        TMP: os.tmpdir(),
      },
    },
  );

  if (install.status !== 0) {
    throw new Error(
      `Unable to bootstrap TypeScript compiler (exit ${install.status ?? "unknown"})`,
    );
  }

  return require(path.join(bootstrapPrefix, "node_modules", "typescript"));
}

const ts = resolveTypeScript();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  ensureDir(dirPath);
}

function loadConfig() {
  const rawConfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (rawConfig.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(rawConfig.error.messageText, "\n"),
    );
  }

  const parsed = ts.parseJsonConfigFileContent(
    rawConfig.config,
    ts.sys,
    projectRoot,
    undefined,
    tsconfigPath,
  );

  return {
    compilerOptions: {
      ...parsed.options,
      noEmitOnError: false,
    },
    fileNames: parsed.fileNames.filter((fileName) => {
      const normalized = path.resolve(fileName);
      if (!normalized.startsWith(path.join(projectRoot, "src"))) {
        return false;
      }
      return !normalized.endsWith(".d.ts");
    }),
    outDir: path.resolve(projectRoot, parsed.options.outDir || "build"),
  };
}

function outputPathFor(fileName, outDir) {
  const relative = path.relative(path.join(projectRoot, "src"), fileName);
  const ext = path.extname(relative);
  const base = relative.slice(0, relative.length - ext.length);
  return path.join(outDir, `${base}.js`);
}

function transpileFile(fileName, compilerOptions, outDir) {
  const sourceText = fs.readFileSync(fileName, "utf8");
  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions,
    fileName,
    reportDiagnostics: true,
  });

  const outputFile = outputPathFor(fileName, outDir);
  ensureDir(path.dirname(outputFile));
  fs.writeFileSync(outputFile, transpiled.outputText, "utf8");

  if (transpiled.sourceMapText) {
    fs.writeFileSync(`${outputFile}.map`, transpiled.sourceMapText, "utf8");
  }

  if (transpiled.diagnostics?.length) {
    for (const diagnostic of transpiled.diagnostics) {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
      );
      process.stderr.write(`[transpile warning] ${fileName}: ${message}\n`);
    }
  }
}

function main() {
  const { compilerOptions, fileNames, outDir } = loadConfig();
  cleanDir(outDir);

  for (const fileName of fileNames) {
    transpileFile(fileName, compilerOptions, outDir);
  }

  process.stdout.write(
    `Transpiled ${fileNames.length} source files to ${outDir}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
}
