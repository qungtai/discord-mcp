#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const REPO = "discord/discord-api-spec";
const REF = "main";
const FILES = ["specs/openapi.json", "specs/openapi_preview.json"];

function resolveCommit() {
  try {
    const out = execSync(
      `gh api repos/${REPO}/commits/${REF} --jq .sha`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (out) return out;
  } catch {
    // fall through
  }
  return null;
}

async function resolveCommitApi() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${REF}`, {
    headers: { "User-Agent": "discord-mcp-coverage" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return data.sha;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function countOps(spec) {
  let n = 0;
  for (const path of Object.keys(spec.paths || {})) {
    const item = spec.paths[path];
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      if (item && item[method]) n += 1;
    }
  }
  return n;
}

function deriveAuth(op, path) {
  const alts = [];
  for (const sec of op.security || []) {
    const keys = Object.keys(sec);
    if (keys.length === 0) {
      if (path.includes("{webhook_token}")) alts.push({ type: "webhook_token" });
      else alts.push({ type: "none" });
      continue;
    }
    for (const key of keys) {
      if (key === "BotToken") {
        alts.push({ type: "bot" });
      } else if (key === "OAuth2") {
        alts.push({ type: "oauth2", scopes: Array.isArray(sec[key]) ? sec[key] : [] });
      } else {
        alts.push({ type: key });
      }
    }
  }
  // de-dupe identical
  const seen = new Set();
  const out = [];
  for (const a of alts) {
    const k = JSON.stringify(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

const DOC_LINKS = {
  applications: "https://discord.com/developers/docs/resources/application",
  channels: "https://discord.com/developers/docs/resources/channel",
  gateway: "https://discord.com/developers/docs/topics/gateway",
  guilds: "https://discord.com/developers/docs/resources/guild",
  interactions: "https://discord.com/developers/docs/interactions/receiving-and-responding",
  invites: "https://discord.com/developers/docs/resources/invite",
  lobbies: "https://discord.com/developers/docs/resources/lobby",
  oauth2: "https://discord.com/developers/docs/topics/oauth2",
  "partner-sdk": "https://discord.com/developers/docs/resources/.../partner-sdk",
  skus: "https://discord.com/developers/docs/monetization/skus",
  "soundboard-default-sounds": "https://discord.com/developers/docs/resources/soundboard",
  "stage-instances": "https://discord.com/developers/docs/resources/stage-instance",
  "sticker-packs": "https://discord.com/developers/docs/resources/sticker",
  stickers: "https://discord.com/developers/docs/resources/sticker",
  users: "https://discord.com/developers/docs/resources/user",
  voice: "https://discord.com/developers/docs/resources/voice",
  webhooks: "https://discord.com/developers/docs/resources/webhook",
};

function groupOf(path) {
  const seg = path.split("/").filter(Boolean)[0] || "";
  return seg.replace(/[{}]/g, "");
}

function capabilityId(method, path) {
  return `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "")}`;
}

function buildRegister(spec, commit) {
  const operations = [];
  for (const path of Object.keys(spec.paths || {}).sort()) {
    const item = spec.paths[path];
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      const op = item && item[method];
      if (!op) continue;
      const group = groupOf(path);
      operations.push({
        capability_id: capabilityId(method, path),
        operation_id: op.operationId || null,
        method: method.toUpperCase(),
        path,
        group,
        source_commit: commit,
        doc_link: DOC_LINKS[group] || "https://discord.com/developers/docs",
        auth: deriveAuth(op, path),
        permissions: null,
        mcp_tool: null,
        implementation: "unmapped",
        availability: "unknown",
        verification: "not_tested",
        evidence: [],
        notes: null,
      });
    }
  }
  // sort by group then method then path
  operations.sort((a, b) => a.group.localeCompare(b.group) || a.method.localeCompare(b.method) || a.path.localeCompare(b.path));
  return operations;
}

function opKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function opKeys(spec) {
  const s = new Set();
  for (const path of Object.keys(spec.paths || {})) {
    const item = spec.paths[path];
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      if (item && item[method]) s.add(opKey(method, path));
    }
  }
  return s;
}

async function main() {
  let commit = resolveCommit();
  if (!commit) commit = await resolveCommitApi();
  if (!commit) throw new Error("Could not resolve commit SHA");

  const cacheDir = join(process.cwd(), "coverage", "specs");
  mkdirSync(cacheDir, { recursive: true });

  const downloaded = {};
  const fileEntries = [];
  for (const f of FILES) {
    const url = `https://raw.githubusercontent.com/${REPO}/${commit}/${f}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download ${f}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const spec = JSON.parse(buf.toString("utf8"));
    downloaded[f] = spec;
    fileEntries.push({ path: f, sha256: sha256(buf), operation_count: countOps(spec) });
    // cache locally
    const localName = f.endsWith("openapi_preview.json") ? "openapi_preview.json" : "openapi.json";
    writeFileSync(join(cacheDir, localName), buf);
  }

  const baseline = {
    repo: REPO,
    commit,
    files: fileEntries,
    retrieved_at: new Date().toISOString(),
  };

  mkdirSync(join(process.cwd(), "coverage"), { recursive: true });
  writeFileSync(join(process.cwd(), "coverage", "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");

  const stableSpec = downloaded["specs/openapi.json"];
  const previewSpec = downloaded["specs/openapi_preview.json"];
  const operations = buildRegister(stableSpec, commit);

  const stableKeys = opKeys(stableSpec);
  const previewKeys = opKeys(previewSpec);
  const previewOnly = [...previewKeys].filter((k) => !stableKeys.has(k)).sort();

  const register = {
    repo: REPO,
    commit,
    generated_at: new Date().toISOString(),
    total_operations: operations.length,
    operations,
    preview_only_operations: previewOnly,
  };
  writeFileSync(join(process.cwd(), "coverage", "register.json"), JSON.stringify(register, null, 2) + "\n");

  console.log(`Pinned commit: ${commit}`);
  console.log(`Stable operations: ${operations.length}`);
  console.log(`Preview-only operations: ${previewOnly.length}`);
  for (const fe of fileEntries) console.log(`${fe.path}: ${fe.sha256} (${fe.operation_count} ops)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
