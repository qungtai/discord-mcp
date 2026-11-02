#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const registerPath = join(root, "coverage", "register.json");
const baselinePath = join(root, "coverage", "baseline.json");
const toolsPath = join(root, "coverage", "tools.json");

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function generateMarkdown() {
  const register = readJsonIfExists(registerPath) || {};
  const baseline = readJsonIfExists(baselinePath) || {};
  const tools = readJsonIfExists(toolsPath);

  const ops = register.operations || [];

  const toolByOp = new Map();
  if (Array.isArray(tools)) {
    for (const t of tools) {
      for (const oid of t.operation_ids || []) {
        if (!toolByOp.has(oid)) toolByOp.set(oid, []);
        toolByOp.get(oid).push(t);
      }
    }
  }

  function tally(field) {
    const out = {};
    for (const o of ops) {
      const v = o[field];
      out[v] = (out[v] || 0) + 1;
    }
    return out;
  }

  function tallyByGroup(field) {
    const groups = {};
    for (const o of ops) {
      groups[o.group] = groups[o.group] || {};
      const v = o[field];
      groups[o.group][v] = (groups[o.group][v] || 0) + 1;
    }
    return groups;
  }

  function mdTable(obj, header) {
    const rows = Object.entries(obj).sort((a, b) => a[0].localeCompare(b[0]));
    let out = `| ${header} | Count |\n| --- | ---: |\n`;
    for (const [k, v] of rows) out += `| ${k} | ${v} |\n`;
    return out;
  }

  const total = ops.length;
  const impl = tally("implementation");
  const avail = tally("availability");
  const verif = tally("verification");

  const groups = [...new Set(ops.map((o) => o.group))].sort();
  const groupCounts = groups.map((g) => {
    const gops = ops.filter((o) => o.group === g);
    return { group: g, operations: gops.length };
  });

  let md = `# Discord API coverage report\n\n`;
  md += `Generated from pinned baseline. Counts are raw inventory totals; they are **not** parity claims.\n\n`;
  md += `## Baseline\n\n`;
  md += `- Repository: \`${baseline.repo || register.repo}\`\n`;
  md += `- Commit: \`${baseline.commit || register.commit}\`\n`;
  md += `- Retrieved at: ${baseline.retrieved_at}\n`;
  md += `- Stable operations: ${total}\n`;
  md += `- Preview-only operations: ${(register.preview_only_operations || []).length}\n\n`;

  md += `## Totals by group\n\n`;
  md += `| Group | Operations |\n| --- | ---: |\n`;
  for (const g of groupCounts) md += `| ${g.group} | ${g.operations} |\n`;
  md += `| **Total** | **${total}** |\n\n`;

  md += `## Implementation status\n\n`;
  md += `${mdTable(impl, "Implementation")}\n`;

  md += `## Availability status\n\n`;
  md += `${mdTable(avail, "Availability")}\n`;

  md += `## Verification status\n\n`;
  md += `${mdTable(verif, "Verification")}\n`;

  md += `## Per-group status dimensions\n\n`;
  md += `| Group | Ops | Implementation | Availability | Verification |\n`;
  md += `| --- | ---: | --- | --- | --- |\n`;
  for (const g of groups) {
    const gops = ops.filter((o) => o.group === g);
    const i = tallyByGroup("implementation")[g] || {};
    const a = tallyByGroup("availability")[g] || {};
    const v = tallyByGroup("verification")[g] || {};
    const fmt = (o) =>
      Object.entries(o)
        .map(([k, n]) => `${k}=${n}`)
        .join(", ") || "-";
    md += `| ${g} | ${gops.length} | ${fmt(i)} | ${fmt(a)} | ${fmt(v)} |\n`;
  }
  md += "\n";

  // Per-toolset view derived from tools.json when present.
  if (Array.isArray(tools)) {
    const byToolset = {};
    for (const o of ops) {
      const ts = (toolByOp.get(o.operation_id) || []).map((t) => t.toolset).filter(Boolean);
      const key = ts.length ? [...new Set(ts)].join(", ") : "unmapped";
      byToolset[key] = (byToolset[key] || 0) + 1;
    }
    md += `## Operations by toolset (from coverage/tools.json)\n\n`;
    md += `${mdTable(byToolset, "Toolset")}\n`;

    md += `## MCP tool mapping\n\n`;
    md += `| Operation | MCP tool(s) |\n| --- | --- |\n`;
    for (const o of ops) {
      const names = (toolByOp.get(o.operation_id) || []).map((t) => t.name);
      if (names.length) md += `| ${o.operation_id || o.capability_id} | ${names.join(", ")} |\n`;
    }
    md += "\n";
  }

  // Per-credential-profile view derived from auth.
  const byProfile = {};
  for (const o of ops) {
    const profiles = (o.auth || []).map((a) => a.type).filter(Boolean);
    const key = profiles.length ? [...new Set(profiles)].join(", ") : "none";
    byProfile[key] = (byProfile[key] || 0) + 1;
  }
  md += `## Operations by credential profile\n\n`;
  md += `${mdTable(byProfile, "Credential profile")}\n`;

  md += `## Preview-only operations\n\n`;
  const po = register.preview_only_operations || [];
  if (po.length === 0) {
    md += "None at this baseline.\n";
  } else {
    for (const k of po) md += `- ${k}\n`;
  }
  md += "\n";
  md += `> Note: Implementation, availability and verification are tracked as independent dimensions. A count of unmapped operations is an inventory fact, not a claim of missing or complete functionality.\n`;

  return md;
}

function main() {
  const md = generateMarkdown();
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "coverage.md"), md);
  const register = readJsonIfExists(registerPath) || {};
  const ops = register.operations || [];
  const groups = [...new Set(ops.map((o) => o.group))];
  console.log(`Wrote docs/coverage.md (${ops.length} operations, ${groups.length} groups)`);
}

import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { main };
