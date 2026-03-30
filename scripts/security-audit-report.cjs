const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const baselinePath = path.join(
  projectRoot,
  "security",
  "npm-audit-baseline.json",
);
const reportDirectory = path.join(projectRoot, "security-reports");
const summaryJsonPath = path.join(reportDirectory, "npm-audit-summary.json");
const summaryMarkdownPath = path.join(reportDirectory, "npm-audit-summary.md");

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function readBaseline() {
  const raw = fs.readFileSync(baselinePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

function runAudit(extraArgs) {
  const result = spawnSync(npmCommand(), ["audit", "--json", ...extraArgs], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
  });

  if (![0, 1].includes(result.status ?? 0)) {
    process.stderr.write(
      result.stderr || result.stdout || "npm audit failed.\n",
    );
    process.exit(result.status ?? 1);
  }

  const combinedOutput =
    `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  const jsonStart = combinedOutput.indexOf("{");
  if (jsonStart === -1) {
    if ((result.status ?? 0) === 0) {
      return {
        auditReportVersion: 2,
        vulnerabilities: {},
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 0,
            critical: 0,
            total: 0,
          },
        },
      };
    }

    throw new Error("npm audit returned no JSON payload.");
  }

  return JSON.parse(combinedOutput.slice(jsonStart));
}

function toFindings(report, scope) {
  return Object.entries(report.vulnerabilities || {}).map(([pkg, entry]) => {
    const advisories = (entry.via || [])
      .filter((item) => item && typeof item === "object" && item.title)
      .map((item) => ({
        source: item.source,
        title: item.title,
        severity: item.severity,
        url: item.url,
      }));

    return {
      package: pkg,
      scope,
      severity: entry.severity,
      isDirect: Boolean(entry.isDirect),
      nodes: entry.nodes || [],
      effects: entry.effects || [],
      advisories,
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
  if (finding.effects.length) {
    notes.push(`effects: ${finding.effects.join(", ")}`);
  }
  if (finding.nodes.length) {
    notes.push(`nodes: ${finding.nodes.join(", ")}`);
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
    "# npm audit summary",
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

const baselineEntries = readBaseline();
const productionAudit = runAudit(["--omit=dev"]);
const fullAudit = runAudit([]);

const productionFindings = toFindings(productionAudit, "production");
const fullFindings = toFindings(fullAudit, "development");

const baselinedDevelopmentFindings = [];
const blockingFindings = [];

for (const finding of productionFindings) {
  if (severityRank[finding.severity] >= severityRank.high) {
    blockingFindings.push(finding);
  }
}

for (const finding of fullFindings) {
  if (
    productionFindings.some(
      (prodFinding) => prodFinding.package === finding.package,
    )
  ) {
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
    metadata: productionAudit.metadata,
    findings: productionFindings,
  },
  full: {
    metadata: fullAudit.metadata,
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
