import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResponseLike } from "@discordjs/rest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { errorOf, harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "discord-mcp-invites-"));
  await mkdir(join(dir, "root"));
  await writeFile(join(dir, "root", "users.csv"), "123456789\n987654321\n");
  return dir;
}

const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

it("updates invite target users via multipart upload", async () => {
  const dir = await tempDir();
  const { client, request } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    makeRequest: async () => empty204(),
  });
  const result = await client.callTool({
    name: "discord_set_invite_target_users",
    arguments: {
      code: "csvinvite",
      file: {
        path: join(dir, "root", "users.csv"),
        content_type: "text/csv",
      },
    },
  });
  expect(result.structuredContent).toEqual({
    updated: true,
    code: "csvinvite",
  });
  const req = request();
  expect([req.method, req.url]).toEqual([
    "PUT",
    "https://discord.com/api/v10/invites/csvinvite/target-users",
  ]);
  const form = req.body as FormData;
  const part = form.get("files[0]") as Blob;
  expect([await part.text(), part.type]).toEqual(["123456789\n987654321\n", "text/csv"]);
});

it("rejects an invalid code with dot segments", async () => {
  const { client, makeRequest } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
  });
  const result = await client.callTool({
    name: "discord_set_invite_target_users",
    arguments: {
      code: "%2e%2e",
      file: { path: "users.csv" },
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "validation",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("maps 403 to permission with ManageGuild requirement", async () => {
  const dir = await tempDir();
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  const result = await client.callTool({
    name: "discord_set_invite_target_users",
    arguments: {
      code: "csvinvite",
      file: { path: join(dir, "root", "users.csv") },
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "permission",
    status: 403,
    discord_code: 50013,
    remediation: "Check the bot permissions; this tool needs ManageGuild",
  });
});

it("maps 404 to not_found", async () => {
  const dir = await tempDir();
  const { client } = await harness({
    policy: new PPolicyEngine([], ["invites"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    makeRequest: async () => json({ message: "Unknown Invite", code: 10006 }, { status: 404 }),
  });
  const result = await client.callTool({
    name: "discord_set_invite_target_users",
    arguments: {
      code: "csvinvite",
      file: { path: join(dir, "root", "users.csv") },
    },
  });
  expect(errorOf(result)).toMatchObject({
    category: "not_found",
    status: 404,
  });
});

it("succeeds when invite resolves to an allowed guild and denies when not allowed", async () => {
  const dir = await tempDir();
  const allowed = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    makeRequest: async (url) => {
      const u = String(url);
      if (u.endsWith("/target-users")) return empty204();
      return json({ code: "csvinvite", guild_id: "500" });
    },
  });
  const successResult = await allowed.client.callTool({
    name: "discord_set_invite_target_users",
    arguments: {
      code: "csvinvite",
      file: { path: join(dir, "root", "users.csv") },
    },
  });
  expect(successResult.structuredContent).toEqual({
    updated: true,
    code: "csvinvite",
  });
  expect(allowed.makeRequest).toHaveBeenCalledTimes(2);

  const denied = await harness({
    policy: new PPolicyEngine(["500"], ["invites"], false),
    files: new PAttachmentService([join(dir, "root")], ""),
    respond: () => ({ code: "csvinvite", guild_id: "999" }),
  });
  const deniedResult = await denied.client.callTool({
    name: "discord_set_invite_target_users",
    arguments: {
      code: "csvinvite",
      file: { path: join(dir, "root", "users.csv") },
    },
  });
  expect(errorOf(deniedResult)).toMatchObject({
    category: "policy",
    message: "Guild is not allowed",
  });
  expect(denied.makeRequest).toHaveBeenCalledTimes(1);
});
