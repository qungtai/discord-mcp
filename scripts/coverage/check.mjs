#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { checkRegisterDrift } from "./sync.mjs";

const root = process.cwd();
const coverageDir = join(root, "coverage");
const baselinePath = join(coverageDir, "baseline.json");
const registerPath = join(coverageDir, "register.json");
const toolsPath = join(coverageDir, "tools.json");
const evidencePath = join(coverageDir, "live-evidence.json");
const specDir = join(coverageDir, "specs");

const ALLOWED = {
  implementation: new Set([
    "unmapped",
    "planned",
    "partial",
    "implemented",
    "deferred",
    "obsolete",
  ]),
  availability: new Set([
    "executable",
    "missing credential",
    "missing permission",
    "Discord approval required",
    "unavailable fixture",
    "unknown",
  ]),
  verification: new Set([
    "not tested",
    "not_tested",
    "schema tested",
    "mocked contract tested",
    "preview tested",
    "live action verified",
  ]),
};

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function sha256File(p) {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function fail(msg) {
  console.error(`CHECK FAILED: ${msg}`);
  process.exitCode = 1;
}

function listOpsFromSpec(spec) {
  const out = new Set();
  for (const path of Object.keys(spec.paths || {})) {
    const item = spec.paths[path];
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      if (item?.[method]) out.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return out;
}

function main() {
  const baseline = readJson(baselinePath);
  const register = readJson(registerPath);

  if (register.repo !== baseline.repo) fail("register.repo != baseline.repo");
  if (register.commit !== baseline.commit) fail("register.commit != baseline.commit");

  // Hash check for cached spec files.
  for (const fe of baseline.files || []) {
    const local = fe.path.endsWith("openapi_preview.json")
      ? "openapi_preview.json"
      : "openapi.json";
    const p = join(specDir, local);
    if (!existsSync(p)) {
      fail(`missing cached spec ${p}`);
      continue;
    }
    const h = sha256File(p);
    if (h !== fe.sha256) fail(`spec hash mismatch for ${fe.path}`);
  }

  // Operation set equality between register and cached stable spec.
  const stableFile = join(specDir, "openapi.json");
  if (existsSync(stableFile)) {
    const spec = readJson(stableFile);
    const specKeys = listOpsFromSpec(spec);
    const regKeys = new Set((register.operations || []).map((o) => `${o.method} ${o.path}`));
    if (specKeys.size !== regKeys.size)
      fail(`operation count mismatch: spec ${specKeys.size} vs register ${regKeys.size}`);
    for (const k of specKeys) if (!regKeys.has(k)) fail(`spec operation missing in register: ${k}`);
    for (const k of regKeys) if (!specKeys.has(k)) fail(`register operation missing in spec: ${k}`);
  }

  // Status vocabulary.
  for (const o of register.operations || []) {
    if (!ALLOWED.implementation.has(o.implementation))
      fail(`bad implementation status: ${o.implementation}`);
    if (!ALLOWED.availability.has(o.availability))
      fail(`bad availability status: ${o.availability}`);
    if (!ALLOWED.verification.has(o.verification))
      fail(`bad verification status: ${o.verification}`);
  }

  // tools.json checks.
  if (!existsSync(toolsPath)) {
    fail("run pnpm build && pnpm tools:manifest first");
  } else {
    const tools = readJson(toolsPath);
    const opIds = new Set((register.operations || []).map((o) => o.operation_id).filter(Boolean));
    if (Array.isArray(tools)) {
      for (const t of tools) {
        for (const oid of t.operation_ids || []) {
          if (!opIds.has(oid)) fail(`tool ${t.name} references unknown operation id ${oid}`);
        }
      }
    }

    // Check register drift against tools.json and live-evidence.json.
    const evidence = existsSync(evidencePath) ? readJson(evidencePath) : null;
    const driftResult = checkRegisterDrift(register, tools, evidence);
    if (!driftResult.ok) {
      fail(driftResult.error);
    }
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  } else {
    console.log("coverage check passed");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { checkRegisterDrift, main };
