#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TOOLSETS, PToolRegistry, TOOLSETS } from "../../dist/core/tool-registry.js";

const root = process.cwd();
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

export async function generateToolsetsBlock() {
  const reg = await PToolRegistry.load(join(root, "dist/operations/"));
  const list = reg.list();
  const byToolset = new Map();
  for (const t of list) {
    if (!byToolset.has(t.toolset)) byToolset.set(t.toolset, []);
    byToolset.get(t.toolset).push(t);
  }

  let out = "| Toolset | Default | Tools | What it covers | Bot permissions |\n";
  out += "| --- | --- | ---: | --- | --- |\n";

  for (const ts of TOOLSETS) {
    const tools = byToolset.get(ts);
    if (!tools) continue;
    const perms = new Set();
    for (const t of tools) {
      for (const p of t.permissions) perms.add(p);
    }
    const permStr = Array.from(perms).sort().join(", ") || "None";
    const def = DEFAULT_TOOLSETS.includes(ts) ? "Yes" : "No";
    out += `| ${ts} | ${def} | ${tools.length} | ${descriptions[ts] || ""} | ${permStr} |\n`;
  }

  out += "\n";
  out +=
    "Default is `core,messages`. Enable more toolsets with `DISCORD_MCP_TOOLSETS` (comma-separated).\n\n";

  for (const ts of TOOLSETS) {
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
  try {
    const formatted = execFileSync("pnpm", ["biome", "format", "--stdin-file-path=block.md"], {
      input: raw,
      encoding: "utf8",
      cwd: root,
    });
    return formatted.trimEnd();
  } catch {
    return raw;
  }
}

export async function updateReadme() {
  const block = await generateToolsetsBlock();
  const readme = readFileSync(readmePath, "utf8");
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
