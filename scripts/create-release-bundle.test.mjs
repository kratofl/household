import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const builder = fileURLToPath(new URL("./create-release-bundle.mjs", import.meta.url));
const fixture = {
  ...process.env,
  REGISTRY: "ghcr.io",
  IMAGE_OWNER: "release-test",
  GITHUB_REPOSITORY: "release-test/household",
  PLATFORMS: "linux/amd64,linux/arm64",
  API_DIGEST: `sha256:${"a".repeat(64)}`,
  WEB_DIGEST: `sha256:${"b".repeat(64)}`,
  UPDATER_DIGEST: `sha256:${"c".repeat(64)}`,
};

function workspace(t) {
  const parent = resolve(tmpdir());
  const directory = mkdtempSync(join(parent, "household-bundle-test-"));
  t.after(() => {
    // Only remove the temporary directory owned by this test, including on Windows.
    assert.ok(resolve(directory).startsWith(`${parent}${sep}household-bundle-test-`));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

for (const [channel, version] of [["stable", "v1.2.3"], ["unstable", "v1.2.4-rc.1"]]) {
  test(`${channel} bundle is complete, checksummed, and usable outside the checkout`, (t) => {
    const directory = workspace(t);
    const output = join(directory, "output");
    execFileSync(process.execPath, [builder, output], {
      env: { ...fixture, CHANNEL: channel, RELEASE_VERSION: version },
    });
    const extracted = join(directory, "extracted");
    mkdirSync(extracted);
    execFileSync("tar", ["-xzf", join(output, "household-release-bundle.tar.gz"), "-C", extracted]);

    const manifest = JSON.parse(readFileSync(join(extracted, "household-release.json"), "utf8"));
    assert.equal(manifest.version, version);
    assert.equal(manifest.channel, channel);
    assert.equal(manifest.repository, "release-test/household");
    assert.equal(manifest.requiresBackup, true);
    assert.equal(manifest.platforms, "linux/amd64,linux/arm64");
    assert.deepEqual(manifest.images, {
      api: { image: "ghcr.io/release-test/household-api", tag: version, digest: fixture.API_DIGEST },
      web: { image: "ghcr.io/release-test/household-web", tag: version, digest: fixture.WEB_DIGEST },
      updater: { image: "ghcr.io/release-test/household-updater", tag: version, digest: fixture.UPDATER_DIGEST },
    });
    const checksumLines = readFileSync(join(extracted, "SHA256SUMS"), "utf8").trim().split("\n");
    const checkedFiles = checksumLines.map((line) => {
      const [expected, path] = line.split("  ");
      const actual = createHash("sha256").update(readFileSync(join(extracted, path))).digest("hex");
      assert.equal(actual, expected, path);
      return path;
    });
    const payload = readdirSync(extracted, { recursive: true })
      .filter((path) => statSync(join(extracted, path)).isFile() && path !== "SHA256SUMS")
      .map((path) => path.replaceAll("\\", "/"));
    assert.deepEqual(checkedFiles.sort(), payload.sort());
    for (const path of [manifest.compose, manifest.envExample, "INSTALL.md", "UPGRADE.md", "observability/loki/loki.yml", "observability/alloy/config.alloy"]) {
      assert.ok(payload.includes(path), `Missing ${path}`);
    }
    assert.ok(payload.some((path) => path.startsWith("observability/grafana/provisioning/")));
    assert.ok(!payload.includes(".env"), "A bundle must not contain local credentials");

    // Parse the extracted installation, never start services or read the real .env.
    execFileSync("docker", ["compose", "--project-name", "household-bundle-test", "--env-file", manifest.envExample, "-f", manifest.compose, "--profile", "observability", "config", "--quiet"], { cwd: extracted });
  });
}

test("invalid release metadata is rejected before creating output", (t) => {
  const directory = workspace(t);
  for (const invalid of [{ RELEASE_VERSION: 'v1.0-$(echo injected)' }, { CHANNEL: "other" }, { API_DIGEST: "" }]) {
    const output = join(directory, "output");
    const result = spawnSync(process.execPath, [builder, output], {
      env: { ...fixture, RELEASE_VERSION: "v1.0.0", CHANNEL: "stable", ...invalid },
      encoding: "utf8",
    });
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(readdirSync(directory), []);
  }
});
