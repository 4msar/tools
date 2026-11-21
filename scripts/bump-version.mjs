// Bumps the version in package.json. Runs from the git pre-commit hook (patch by default).
// Usage: node scripts/bump-version.mjs [major|minor|patch]. Set SKIP_BUMP=1 to skip.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (["1", "true", "yes"].includes(process.env.SKIP_BUMP ?? "")) process.exit(0);

const part = process.argv[2] ?? "patch";
if (!["major", "minor", "patch"].includes(part)) {
    console.error(`Unknown version part "${part}" (use major, minor or patch).`);
    process.exit(1);
}

const file = fileURLToPath(new URL("../package.json", import.meta.url));
const raw = readFileSync(file, "utf8");
const pkg = JSON.parse(raw);
const indent = raw.match(/^[ \t]+/m)?.[0] ?? "  ";
const old = pkg.version ?? "0.0.0";
let [major, minor, patch] = old.split(".").map((n) => parseInt(n, 10) || 0);

if (part === "major") [major, minor, patch] = [major + 1, 0, 0];
else if (part === "minor") [minor, patch] = [minor + 1, 0];
else patch += 1;

pkg.version = `${major}.${minor}.${patch}`;
writeFileSync(file, JSON.stringify(pkg, null, indent) + (raw.endsWith("\n") ? "\n" : ""));
console.log(`version: ${old} → ${pkg.version}`);
