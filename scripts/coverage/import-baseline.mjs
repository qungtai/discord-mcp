#!/usr/bin/env node
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REPO = "discord/discord-api-spec";
const FILES = ["specs/openapi.json", "specs/openapi_preview.json"];
const LEDGER_FIELDS = [
	"permissions",
	"mcp_tool",
	"implementation",
	"availability",
	"verification",
	"evidence",
	"notes",
];

function readJsonIfExists(filePath) {
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}

function parseArgs(argv) {
	let commit = null;
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === "--commit") {
			commit = argv[i + 1] || null;
			i += 1;
		}
	}
	return commit;
}

function resolveCommit(ref) {
	try {
		const out = execSync(`gh api repos/${REPO}/commits/${ref} --jq .sha`, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		if (out) return out;
	} catch (err) {
		console.error(`gh resolve failed: ${err?.message ? err.message : err}`);
	}
	return null;
}

async function resolveCommitApi(ref) {
	const res = await fetch(
		`https://api.github.com/repos/${REPO}/commits/${ref}`,
		{
			headers: { "User-Agent": "discord-mcp-coverage" },
		},
	);
	if (!res.ok) throw new Error(`GitHub API ${res.status}`);
	const data = await res.json();
	return data.sha;
}

function sha256(buf) {
	return createHash("sha256").update(buf).digest("hex");
}

function listOperations(spec) {
	const out = [];
	for (const path of Object.keys(spec.paths || {})) {
		const item = spec.paths[path];
		for (const method of [
			"get",
			"post",
			"put",
			"patch",
			"delete",
			"head",
			"options",
			"trace",
		]) {
			const op = item?.[method];
			if (op) out.push({ path, method, op });
		}
	}
	return out;
}

function countOps(spec) {
	return listOperations(spec).length;
}

function deriveAuth(op, path) {
	const alts = [];
	for (const sec of op.security || []) {
		const keys = Object.keys(sec);
		if (keys.length === 0) {
			if (path.includes("{webhook_token}"))
				alts.push({ type: "webhook_token" });
			else if (path.includes("{interaction_token}"))
				alts.push({ type: "interaction_token" });
			else alts.push({ type: "none" });
			continue;
		}
		for (const key of keys) {
			if (key === "BotToken") {
				alts.push({ type: "bot" });
			} else if (key === "OAuth2") {
				alts.push({
					type: "oauth2",
					scopes: Array.isArray(sec[key]) ? sec[key] : [],
				});
			} else {
				alts.push({ type: key });
			}
		}
	}
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
	interactions:
		"https://discord.com/developers/docs/interactions/receiving-and-responding",
	invites: "https://discord.com/developers/docs/resources/invite",
	lobbies: "https://discord.com/developers/docs/resources/lobby",
	oauth2: "https://discord.com/developers/docs/topics/oauth2",
	"partner-sdk":
		"https://discord.com/developers/docs/resources/.../partner-sdk",
	skus: "https://discord.com/developers/docs/monetization/skus",
	"soundboard-default-sounds":
		"https://discord.com/developers/docs/resources/soundboard",
	"stage-instances":
		"https://discord.com/developers/docs/resources/stage-instance",
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
	for (const { path, method, op } of listOperations(spec)) {
		const group = groupOf(path);
		operations.push({
			capability_id: capabilityId(method, path),
			operation_id: op.operationId || null,
			method: method.toUpperCase(),
			path,
			group,
			source_commit: commit,
			doc_link:
				op.externalDocs?.url ||
				DOC_LINKS[group] ||
				"https://discord.com/developers/docs",
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
	operations.sort(
		(a, b) =>
			a.group.localeCompare(b.group) ||
			a.method.localeCompare(b.method) ||
			a.path.localeCompare(b.path),
	);
	return operations;
}

function opKey(method, path) {
	return `${method.toUpperCase()} ${path}`;
}

function opKeys(spec) {
	const s = new Set();
	for (const { path, method } of listOperations(spec))
		s.add(opKey(method, path));
	return s;
}

async function main() {
	const root = process.cwd();
	const coverageDir = join(root, "coverage");
	const cacheDir = join(coverageDir, "specs");
	const baselinePath = join(coverageDir, "baseline.json");
	const registerPath = join(coverageDir, "register.json");

	const existingBaseline = readJsonIfExists(baselinePath);
	const existingRegister = readJsonIfExists(registerPath);

	let commit = parseArgs(process.argv.slice(2));
	if (!commit) commit = existingBaseline?.commit;
	if (!commit) {
		commit = resolveCommit("main");
		if (!commit) commit = await resolveCommitApi("main");
	}
	if (!commit) throw new Error("Could not resolve commit SHA");

	mkdirSync(cacheDir, { recursive: true });
	mkdirSync(coverageDir, { recursive: true });

	const downloaded = {};
	const fileEntries = [];
	for (const f of FILES) {
		const url = `https://raw.githubusercontent.com/${REPO}/${commit}/${f}`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Download ${f}: ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		const spec = JSON.parse(buf.toString("utf8"));
		downloaded[f] = spec;
		fileEntries.push({
			path: f,
			sha256: sha256(buf),
			operation_count: countOps(spec),
		});
		const localName = f.endsWith("openapi_preview.json")
			? "openapi_preview.json"
			: "openapi.json";
		writeFileSync(join(cacheDir, localName), buf);
	}

	const stableSpec = downloaded["specs/openapi.json"];
	const previewSpec = downloaded["specs/openapi_preview.json"];
	const newOps = buildRegister(stableSpec, commit);

	// Preserve ledger fields from existing entries keyed by capability_id.
	const existingOps = new Map(
		(existingRegister?.operations ? existingRegister.operations : []).map(
			(o) => [o.capability_id, o],
		),
	);
	for (const op of newOps) {
		const old = existingOps.get(op.capability_id);
		if (old) {
			for (const f of LEDGER_FIELDS) {
				if (old[f] !== undefined) op[f] = old[f];
			}
		}
	}

	const added = newOps
		.filter((o) => !existingOps.has(o.capability_id))
		.map((o) => o.capability_id);
	const removed = [...existingOps.keys()].filter(
		(k) => !newOps.some((o) => o.capability_id === k),
	);
	const changed = newOps
		.filter((o) => {
			const old = existingOps.get(o.capability_id);
			if (!old) return false;
			return (
				old.method !== o.method ||
				old.path !== o.path ||
				old.group !== o.group ||
				JSON.stringify(old.auth) !== JSON.stringify(o.auth) ||
				old.source_commit !== o.source_commit
			);
		})
		.map((o) => o.capability_id);

	if (added.length) console.log(`Added: ${added.join(", ")}`);
	if (removed.length) console.log(`Removed: ${removed.join(", ")}`);
	if (changed.length) console.log(`Changed: ${changed.join(", ")}`);

	const stableKeys = opKeys(stableSpec);
	const previewKeys = opKeys(previewSpec);
	const previewOnly = [...previewKeys].filter((k) => !stableKeys.has(k)).sort();

	const generatedAt =
		existingRegister &&
		existingRegister.commit === commit &&
		existingRegister.generated_at
			? existingRegister.generated_at
			: new Date().toISOString();

	const register = {
		repo: REPO,
		commit,
		generated_at: generatedAt,
		total_operations: newOps.length,
		operations: newOps,
		preview_only_operations: previewOnly,
	};

	writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

	const baseline = {
		repo: REPO,
		commit,
		files: fileEntries,
		retrieved_at: new Date().toISOString(),
	};
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);

	console.log(`Pinned commit: ${commit}`);
	console.log(`Stable operations: ${newOps.length}`);
	console.log(`Preview-only operations: ${previewOnly.length}`);
	for (const fe of fileEntries)
		console.log(`${fe.path}: ${fe.sha256} (${fe.operation_count} ops)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}

export { main };
