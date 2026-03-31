#!/usr/bin/env bun

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const baselinePath = path.join(
  projectRoot,
  "security",
  "bun-audit-baseline.json",
);
const reportDirectory = path.join(projectRoot, "security-reports");
const summaryJsonPath = path.join(reportDirectory, "bun-audit-summary.json");
const summaryMarkdownPath = path.join(reportDirectory, "bun-audit-summary.md");
const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function runBun(args, options = {}) {
  const result = spawnSync("bun", args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    shell: process.platform === "win32",
  });

  if (![0, 1].includes(result.status ?? 0)) {
    process.stderr.write(result.stderr || result.stdout || "bun command failed.\n");
    process.exit(result.status ?? 1);
  }

  return result;
}

function readBaseline() {
  const raw = fs.readFileSync(baselinePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

function parseAuditJson(result) {
  const payload = (result.stdout || "").trim();
  if (!payload) {
    return {};
  }
  return JSON.parse(payload);
}

function summarizeVulnerabilities(report) {
  const summary = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };

  for (const advisories of Object.values(report)) {
    for (const advisory of advisories) {
      const severity = advisory.severity || "info";
      if (severity in summary) {
        summary[severity] += 1;
      } else {
        summary.info += 1;
      }
      summary.total += 1;
    }
  }

  return summary;
}

function toFindings(report, scope) {
  return Object.entries(report).map(([pkg, advisories]) => {
    const highestSeverity = advisories.reduce((current, advisory) => {
      const severity = advisory.severity || "info";
      return severityRank[severity] > severityRank[current] ? severity : current;
    }, "info");

    return {
      package: pkg,
      scope,
      severity: highestSeverity,
      advisories: advisories.map((advisory) => ({
        id: advisory.id,
        title: advisory.title,
        severity: advisory.severity,
        url: advisory.url,
      })),
      effects: [],
      nodes: [],
    };
  });
}

function matchBaseline(finding, baselineEntries) {
  return baselineEntries.find(
    (entry) =>
      entry.package === finding.package &&
      entry.scope === finding.scope &&
      entry.severity === finding.severity,
  );
}

function formatFinding(finding, baselineEntry) {
  const headline = `${finding.package} (${finding.scope}, ${finding.severity})`;
  const notes = [];

  if (finding.advisories.length) {
    notes.push(
      `advisories: ${finding.advisories.map((item) => item.title).join(" | ")}`,
    );
  }
  if (finding.advisories.some((item) => item.url)) {
    notes.push(
      `urls: ${finding.advisories
        .map((item) => item.url)
        .filter(Boolean)
        .join(", ")}`,
    );
  }
  if (baselineEntry) {
    notes.push(
      `baseline: ${baselineEntry.reason} (review by ${baselineEntry.reviewBy})`,
    );
  }

  return `- ${headline}\n  ${notes.join("\n  ")}`;
}

function writeReports(payload) {
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(summaryJsonPath, JSON.stringify(payload, null, 2) + "\n");

  const sections = [
    "# bun audit summary",
    "",
    `- generatedAt: ${payload.generatedAt}`,
    `- blockingFindings: ${payload.blockingFindings.length}`,
    `- baselinedDevelopmentFindings: ${payload.baselinedDevelopmentFindings.length}`,
    `- productionVulnerabilities: ${JSON.stringify(payload.production.metadata.vulnerabilities)}`,
    `- fullAuditVulnerabilities: ${JSON.stringify(payload.full.metadata.vulnerabilities)}`,
    "",
    "## Blocking findings",
    ...(payload.blockingFindings.length
      ? payload.blockingFindings.map((item) => formatFinding(item, null))
      : ["- none"]),
    "",
    "## Baselined development findings",
    ...(payload.baselinedDevelopmentFindings.length
      ? payload.baselinedDevelopmentFindings.map((item) =>
          formatFinding(item.finding, item.baseline),
        )
      : ["- none"]),
  ];

  fs.writeFileSync(summaryMarkdownPath, sections.join("\n") + "\n");
}

function createProductionAuditWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xread-bun-audit-"));
  fs.copyFileSync(
    path.join(projectRoot, "package.json"),
    path.join(tempRoot, "package.json"),
  );
  fs.copyFileSync(path.join(projectRoot, "bun.lock"), path.join(tempRoot, "bun.lock"));
  return tempRoot;
}

function runAudit(extraArgs, options = {}) {
  return parseAuditJson(runBun(["audit", "--json", ...extraArgs], options));
}

const baselineEntries = readBaseline();
const fullAudit = runAudit([]);

const productionWorkspace = createProductionAuditWorkspace();
runBun(["install", "--frozen-lockfile", "--omit=dev", "--ignore-scripts"], {
  cwd: productionWorkspace,
});
const productionAudit = runAudit([], { cwd: productionWorkspace });
fs.rmSync(productionWorkspace, { recursive: true, force: true });

const productionFindings = toFindings(productionAudit, "production");
const fullFindings = toFindings(fullAudit, "development");
const baselinedDevelopmentFindings = [];
const blockingFindings = [];
const productionPackages = new Set(productionFindings.map((finding) => finding.package));

for (const finding of productionFindings) {
  if (severityRank[finding.severity] >= severityRank.high) {
    blockingFindings.push(finding);
  }
}

for (const finding of fullFindings) {
  if (productionPackages.has(finding.package)) {
    continue;
  }

  const baselineEntry = matchBaseline(finding, baselineEntries);
  if (baselineEntry) {
    baselinedDevelopmentFindings.push({ finding, baseline: baselineEntry });
    continue;
  }

  if (severityRank[finding.severity] >= severityRank.high) {
    blockingFindings.push(finding);
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  production: {
    metadata: {
      vulnerabilities: summarizeVulnerabilities(productionAudit),
    },
    findings: productionFindings,
  },
  full: {
    metadata: {
      vulnerabilities: summarizeVulnerabilities(fullAudit),
    },
    findings: fullFindings,
  },
  blockingFindings,
  baselinedDevelopmentFindings,
};

writeReports(payload);

if (blockingFindings.length) {
  process.stderr.write(
    `Security audit failed with ${blockingFindings.length} blocking finding(s).\n`,
  );
  process.exit(1);
}

process.stdout.write("Security audit policy passed.\n");
