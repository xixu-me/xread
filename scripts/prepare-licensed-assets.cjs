#!/usr/bin/env bun

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ASSETS = [
  {
    path: "licensed/GeoLite2-City.mmdb",
    url: "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-City.mmdb",
  },
];

async function downloadAsset(asset, destination) {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${asset.url}: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(arrayBuffer));
}

async function ensureLicensedAssets({
  rootDir = __dirname ? path.resolve(__dirname, "..") : process.cwd(),
  assets = DEFAULT_ASSETS,
  downloadAsset: downloadImpl = downloadAsset,
} = {}) {
  for (const asset of assets) {
    const destination = path.resolve(rootDir, asset.path);
    if (fs.existsSync(destination)) {
      continue;
    }

    await downloadImpl(asset, destination);
  }
}

if (require.main === module) {
  ensureLicensedAssets()
    .then(() => {
      process.stdout.write("Licensed assets are ready.\n");
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error}\n`);
      process.exit(1);
    });
}

module.exports = {
  DEFAULT_ASSETS,
  downloadAsset,
  ensureLicensedAssets,
};
