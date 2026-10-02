import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// CI tests and release publishing use the same bundle builder. Output must be fresh.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.argv[2] ?? "dist");
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const version = required("RELEASE_VERSION");
if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(version)) {
  throw new Error("RELEASE_VERSION must be a valid Docker image tag");
}
const channel = required("CHANNEL");
if (channel !== "stable" && channel !== "unstable") {
  throw new Error("CHANNEL must be stable or unstable");
}
const registry = required("REGISTRY");
const owner = required("IMAGE_OWNER");
const images = Object.fromEntries(["api", "web", "updater"].map((service) => {
  const digest = required(`${service.toUpperCase()}_DIGEST`);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid ${service} image digest`);
  return [service, { image: `${registry}/${owner}/household-${service}`, tag: version, digest }];
}));
const manifest = {
  version,
  channel,
  repository: required("GITHUB_REPOSITORY"),
  compose: "docker-compose.yml",
  envExample: ".env.example",
  platforms: required("PLATFORMS"),
  images,
  requiresBackup: true,
};

mkdirSync(output);
copyFileSync(join(root, "deployments/docker-compose.yml"), join(output, "docker-compose.yml"));
copyFileSync(join(root, "deployments/.env.example"), join(output, ".env.example"));
cpSync(join(root, "deployments/observability"), join(output, "observability"), { recursive: true });
writeFileSync(join(output, "INSTALL.md"), `# Household release bundle

1. Copy \`.env.example\` to \`.env\`.
2. Replace every \`change-me\` value.
3. Set \`HOUSEHOLD_SEED_DEMO_USER=true\` for first boot.
4. Start the stack:

   \`\`\`bash
   docker compose --env-file .env -f docker-compose.yml pull
   docker compose --env-file .env -f docker-compose.yml up -d
   \`\`\`

After the first admin account is usable, set \`HOUSEHOLD_SEED_DEMO_USER=false\` and restart.
`);
writeFileSync(join(output, "UPGRADE.md"), `# Upgrade notes

Create a backup before upgrading. To upgrade manually, set \`HOUSEHOLD_VERSION\` in \`.env\`, pull images, and restart the stack.

\`\`\`bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d
\`\`\`

If you need to roll back, restore the backup and set \`HOUSEHOLD_VERSION\` back to the previous release tag.
`);
writeFileSync(join(output, "household-release.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const files = readdirSync(output, { recursive: true })
  .filter((path) => statSync(join(output, path)).isFile())
  .map((path) => path.replaceAll("\\", "/"))
  .sort();
const checksums = files.map((path) => {
  const digest = createHash("sha256").update(readFileSync(join(output, path))).digest("hex");
  return `${digest}  ${path}\n`;
});
writeFileSync(join(output, "SHA256SUMS"), checksums.join(""));
execFileSync("tar", ["-czf", join(output, "household-release-bundle.tar.gz"), "-C", output, ...files, "SHA256SUMS"], { stdio: "inherit" });
