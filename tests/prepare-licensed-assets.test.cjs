const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("ensureLicensedAssets creates GeoLite database when missing", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xread-licensed-"));
  const targetFile = path.join(tempRoot, "licensed", "GeoLite2-City.mmdb");
  let downloadCalls = 0;

  const {
    ensureLicensedAssets,
    DEFAULT_ASSETS,
  } = require("../scripts/prepare-licensed-assets.cjs");

  await ensureLicensedAssets({
    rootDir: tempRoot,
    assets: DEFAULT_ASSETS,
    downloadAsset: async (asset, destination) => {
      downloadCalls += 1;
      assert.equal(asset.path, "licensed/GeoLite2-City.mmdb");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from("fake-mmdb"));
    },
  });

  assert.equal(downloadCalls, 1);
  assert.equal(fs.existsSync(targetFile), true);
  assert.equal(fs.readFileSync(targetFile, "utf8"), "fake-mmdb");
});
