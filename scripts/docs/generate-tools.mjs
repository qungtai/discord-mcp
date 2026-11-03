#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PermissionFlagsBits } from "discord-api-types/v10";

const root = fileURLToPath(new URL("../..", import.meta.url));
const readmePath = join(root, "README.md");

const descriptions = {
  core: "Current bot user, user lookup, guild list and leave, user connections",
  messages: "Send, get, edit, delete, pin, search messages, polls, attachments",
  reactions: "Add, remove, list reactions on messages",
  threads: "Create, list, join, leave, archive threads and thread members",
  channels: "Create, edit, delete channels, permission overwrites, voice status",
  webhooks: "Create, edit, delete, execute webhooks and edit webhook messages",
  guild: "Guild settings, audit log, onboarding, welcome screen, widget",
  members: "List, search, update, kick, mute, deafen members, prune",
  roles: "Create, update, delete, list guild roles, role member counts",
  moderation: "Ban, unban, list bans, AutoMod rules",
  events: "Create, update, delete scheduled events and list subscribers",
  invites: "Create, get, delete invites, guild/channel invites, target users",
};

export function renderToolsBlock(registry, toolsets, defaultToolsets) {
  if (!toolsets || !defaultToolsets) {
    throw new Error("toolsets and defaultToolsets are required");
  }
  const list = registry.list();
  const byToolset = new Map();
  for (const t of list) {
    if (!byToolset.has(t.toolset)) byToolset.set(t.toolset, []);
    byToolset.get(t.toolset).push(t);
  }

  let defaultBits = 0n;
  let allBits = 0n;
  for (const ts of toolsets) {
    const tools = byToolset.get(ts);
    if (!tools) continue;
    for (const t of tools) {
      for (const p of t.permissions) {
        const bit = PermissionFlagsBits[p];
        if (bit === undefined) {
          throw new Error(`Unknown permission flag: ${p}`);
        }
        allBits |= bit;
        if (defaultToolsets.includes(ts)) {
          defaultBits |= bit;
        }
      }
    }
  }

  let out = "| Toolset | Default | Tools | What it covers | Bot permissions |\n";
  out += "| --- | --- | ---: | --- | --- |\n";

  for (const ts of toolsets) {
    const tools = byToolset.get(ts);
    if (!tools) continue;
    const desc = descriptions[ts];
    if (!desc) {
      throw new Error(`Missing description for toolset: ${ts}`);
    }
    const perms = new Set();
    for (const t of tools) {
      for (const p of t.permissions) perms.add(p);
    }
    const permStr = Array.from(perms).sort().join(", ") || "None";
    const def = defaultToolsets.includes(ts) ? "Yes" : "No";
    out += `| ${ts} | ${def} | ${tools.length} | ${desc} | ${permStr} |\n`;
  }

  out += "\n";
  out += `Default is \`${defaultToolsets.join(",")}\`. Enable more toolsets with \`DISCORD_MCP_TOOLSETS\` (comma-separated).\n\n`;
  out += `Permissions integer for the default toolsets: \`${defaultBits.toString()}\`.\n`;
  out += `Permissions integer for all implemented toolsets: \`${allBits.toString()}\`.\n\n`;

  for (const ts of toolsets) {
    const tools = byToolset.get(ts);
    if (!tools) continue;
    out += `<details>\n`;
    out += `<summary>${ts} (${tools.length} tools)</summary>\n\n`;
    for (const t of tools) {
      const approval = t.approval ? " (asks for approval)" : "";
      out += `- \`${t.name}\`: ${t.description}${approval}\n`;
    }
    out += `\n</details>\n\n`;
  }

  const raw = out.trimEnd();
  // Format with Biome so formatting is consistent with `biome check`
  const formatted = execFileSync("pnpm", ["biome", "format", "--stdin-file-path=block.md"], {
    input: raw,
    encoding: "utf8",
    cwd: root,
  });
  return formatted.trimEnd();
}

export function computeSummaryNumbers(registry, toolsets) {
  const tools = registry.list();
  const operations = new Set();
  for (const t of tools) {
    const ops = t.operationIds || [];
    for (const op of ops) operations.add(op);
  }
  const implementedToolsets = toolsets.filter((ts) => {
    return tools.some((t) => t.toolset === ts);
  });

  const baseline = JSON.parse(readFileSync(join(root, "coverage/baseline.json"), "utf8"));
  const register = JSON.parse(readFileSync(join(root, "coverage/register.json"), "utf8"));
  const totalOperations = baseline.files?.[0]?.operation_count ?? register.total_operations;
  let liveCount = 0;
  let mockCount = 0;
  for (const op of register.operations || []) {
    if (op.verification === "live action verified") liveCount++;
    else if (op.verification === "mocked contract tested") mockCount++;
  }

  return {
    toolCount: tools.length,
    operationCount: operations.size,
    implementedToolsets,
    totalOperations,
    liveCount,
    mockCount,
  };
}

export function renderSummary(summary) {
  return `- ${summary.toolCount} tools across ${summary.implementedToolsets.join(", ")}.
- ${summary.operationCount} of the ${summary.totalOperations} stable Discord API operations are implemented (see [docs/coverage.md](docs/coverage.md)); ${summary.liveCount} are verified against a live server and ${summary.mockCount} against mocked contracts.`;
}

export async function updateReadme() {
  const { DEFAULT_TOOLSETS, PToolRegistry, TOOLSETS } = await import(
    "../../dist/core/tool-registry.js"
  );
  const reg = await PToolRegistry.load(join(root, "dist/operations/"));
  const block = renderToolsBlock(reg, TOOLSETS, DEFAULT_TOOLSETS);
  const summary = computeSummaryNumbers(reg, TOOLSETS);

  let readme = readFileSync(readmePath, "utf8");

  // Update summary counts block
  const summaryStart = "<!-- summary:start -->";
  const summaryEnd = "<!-- summary:end -->";
  const sStartIdx = readme.indexOf(summaryStart);
  const sEndIdx = readme.indexOf(summaryEnd);
  if (sStartIdx === -1 || sEndIdx === -1 || sEndIdx <= sStartIdx) {
    throw new Error(
      `Markers ${summaryStart} and ${summaryEnd} not found or malformed in README.md`,
    );
  }
  const summaryText = renderSummary(summary);
  readme = `${readme.slice(0, sStartIdx + summaryStart.length)}\n${summaryText}\n${readme.slice(sEndIdx)}`;

  // Update toolsets list block in configuration
  const configToolsetsStart = "<!-- config-toolsets:start -->";
  const configToolsetsEnd = "<!-- config-toolsets:end -->";
  const cStartIdx = readme.indexOf(configToolsetsStart);
  const cEndIdx = readme.indexOf(configToolsetsEnd);
  if (cStartIdx === -1 || cEndIdx === -1 || cEndIdx <= cStartIdx) {
    throw new Error(
      `Markers ${configToolsetsStart} and ${configToolsetsEnd} not found or malformed in README.md`,
    );
  }
  const listText = `Available: ${summary.implementedToolsets.join(", ")}.`;
  readme = `${readme.slice(0, cStartIdx + configToolsetsStart.length)} ${listText} ${readme.slice(cEndIdx)}`;

  // Update toolsets block
  const startMarker = "<!-- tools:start -->";
  const endMarker = "<!-- tools:end -->";

  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Markers ${startMarker} and ${endMarker} not found or malformed in README.md`);
  }

  const updated = `${readme.slice(0, startIndex + startMarker.length)}\n${block}\n${readme.slice(endIndex)}`;
  writeFileSync(readmePath, updated, "utf8");
  console.log("Updated tool reference in README.md");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  updateReadme().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
