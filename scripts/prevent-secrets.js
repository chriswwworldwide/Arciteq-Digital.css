/**
 * prevent-secrets.js
 * ------------------
 * Blocks commits that introduce credentials or environment files.
 * Scans staged content when run from a git hook, otherwise all tracked files.
 */

import { execSync } from "child_process";
import fs from "fs";

const PATTERNS = [
  { name: "Stripe secret key", re: /\bsk_(live|test)_[A-Za-z0-9]{16,}/ },
  { name: "Stripe live publishable key", re: /\bpk_live_[A-Za-z0-9]{16,}/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "SendGrid key", re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/ },
  { name: "Private key block", re: /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----/ },
  {
    name: "Hardcoded credential assignment",
    re: /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|password)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
];

const BLOCKED_FILES = [/(^|\/)\.env(\.|$)/, /\.(pem|p12|pfx|key)$/i];

const ALLOWED_FILES = [/(^|\/)\.env\.example$/, /(^|\/)prevent-secrets\.js$/];

const SKIPPED_FILES = [
  /(^|\/)node_modules\//,
  /(^|\/)package-lock\.json$/,
  /\.(png|jpe?g|gif|webp|ico|svg|woff2?|tar\.gz|tgz|zip)$/i,
];

function stagedFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}

function trackedFiles() {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function scan(files) {
  const findings = [];

  for (const file of files) {
    if (ALLOWED_FILES.some((re) => re.test(file))) continue;
    if (SKIPPED_FILES.some((re) => re.test(file))) continue;

    if (BLOCKED_FILES.some((re) => re.test(file))) {
      findings.push({ file, line: 0, name: "Environment/key file" });
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    content.split("\n").forEach((text, index) => {
      for (const { name, re } of PATTERNS) {
        if (re.test(text)) findings.push({ file, line: index + 1, name });
      }
    });
  }

  return findings;
}

const staged = stagedFiles();
const findings = scan(staged.length ? staged : trackedFiles());

if (findings.length) {
  console.error("❌ Potential secrets detected — commit blocked:\n");
  for (const { file, line, name } of findings) {
    console.error(`  ${file}${line ? `:${line}` : ""} → ${name}`);
  }
  console.error(
    "\nMove the value into an environment variable (see .env.example) and retry.",
  );
  process.exit(1);
}

console.log("✅ No secrets detected in scanned files.");
