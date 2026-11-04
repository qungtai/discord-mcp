import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import {
  buildBehaviorSentence,
  buildServerInstructions,
  createServer,
  formatPermissionName,
} from "../../../src/adapters/mcp/server.js";
import { PToolPipeline } from "../../../src/core/pipeline.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { createScopeResolver } from "../../../src/core/scope.js";
import { DEFAULT_TOOLSETS, defineTool, PToolRegistry } from "../../../src/core/tool-registry.js";

describe("createServer", () => {
  it("reports serverInfo.version matching package.json version", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const pipeline = new PToolPipeline(new PToolRegistry(), new PPolicyEngine([], [], false), {
      credentials: { bot: {} as never },
      files: {} as never,
      resolveScope: createScopeResolver(),
    });
    const server = createServer(pipeline);
    expect(
      (server as unknown as { _serverInfo: { name: string; version: string } })._serverInfo.version,
    ).toBe(pkg.version);
  });

  describe("formatPermissionName", () => {
    it("maps special Developer Portal permission overrides correctly", () => {
      expect(formatPermissionName("ManageGuild")).toBe("Manage Server");
      expect(formatPermissionName("CreateInstantInvite")).toBe("Create Invite");
      expect(formatPermissionName("ModerateMembers")).toBe("Timeout Members");
      expect(formatPermissionName("ManageGuildExpressions")).toBe("Manage Expressions");
      expect(formatPermissionName("SendMessagesInThreads")).toBe("Send Messages in Threads");
      expect(formatPermissionName("MentionEveryone")).toBe(
        "Mention @everyone, @here, and All Roles",
      );
    });

    it("inserts spaces into PascalCase permission names", () => {
      expect(formatPermissionName("ViewChannel")).toBe("View Channel");
      expect(formatPermissionName("SendTTSMessages")).toBe("Send TTS Messages");
      expect(formatPermissionName("ReadMessageHistory")).toBe("Read Message History");
    });
  });

  describe("buildBehaviorSentence", () => {
    it("renders sentence for read tool with permissions: View Channel", () => {
      const tool = defineTool({
        name: "discord_test_read",
        description: "Read test tool.",
        operationIds: ["test_read"],
        toolset: "core",
        scope: "none",
        permissions: ["ViewChannel"],
        effect: "read",
        idempotent: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "Bot permissions: View Channel. Read-only; safe to retry.",
      );
    });

    it("renders sentence for tool with no permissions", () => {
      const tool = defineTool({
        name: "discord_test_no_perm",
        description: "No perm tool.",
        operationIds: ["test_no_perm"],
        toolset: "core",
        scope: "none",
        permissions: [],
        effect: "read",
        idempotent: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "No special bot permissions. Read-only; safe to retry.",
      );
    });

    it("renders sentence for write and idempotent tool with approval under elicitation", () => {
      const tool = defineTool({
        name: "discord_test_write_idempotent",
        description: "Write idempotent tool.",
        operationIds: ["test_write_idempotent"],
        toolset: "roles",
        scope: "none",
        permissions: ["ManageRoles"],
        effect: "write",
        idempotent: true,
        approval: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "Bot permissions: Manage Roles. Changes Discord data; safe to retry. The user is asked to approve the exact change before it runs.",
      );
    });

    it("renders sentence for write and not idempotent tool with approval under elicitation", () => {
      const tool = defineTool({
        name: "discord_test_write_not_idempotent",
        description: "Write not idempotent tool.",
        operationIds: ["test_write_not_idempotent"],
        toolset: "invites",
        scope: "none",
        permissions: ["ManageGuild"],
        effect: "write",
        idempotent: false,
        approval: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "Bot permissions: Manage Server. Creates Discord data; a retry can create a duplicate. The user is asked to approve the exact change before it runs.",
      );
    });

    it("renders sentence for write tool with approval under none mode", () => {
      const tool = defineTool({
        name: "discord_test_write_approval_none",
        description: "Write tool.",
        operationIds: ["test_write_approval_none"],
        toolset: "roles",
        scope: "none",
        permissions: ["ManageRoles"],
        effect: "write",
        idempotent: true,
        approval: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "none")).toBe(
        "Bot permissions: Manage Roles. Changes Discord data; safe to retry.",
      );
    });

    it("renders sentence for destructive with approval and DISCORD_MCP_APPROVAL=elicitation", () => {
      const tool = defineTool({
        name: "discord_test_destructive_approval",
        description: "Destructive approval tool.",
        operationIds: ["test_destructive_approval"],
        toolset: "moderation",
        scope: "none",
        permissions: ["BanMembers"],
        effect: "destructive",
        idempotent: true,
        approval: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "Bot permissions: Ban Members. Destructive: the user is asked to approve the exact change before it runs.",
      );
    });

    it("renders sentence for destructive with approval and DISCORD_MCP_APPROVAL=none", () => {
      const tool = defineTool({
        name: "discord_test_destructive_approval_none",
        description: "Destructive approval tool.",
        operationIds: ["test_destructive_approval_none"],
        toolset: "moderation",
        scope: "none",
        permissions: ["BanMembers"],
        effect: "destructive",
        idempotent: true,
        approval: true,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "none")).toBe(
        "Bot permissions: Ban Members. Changes or removes existing Discord data without an approval prompt.",
      );
    });

    it("renders sentence for destructive without approval (approval: false)", () => {
      const tool = defineTool({
        name: "discord_test_destructive_no_approval",
        description: "Destructive no approval tool.",
        operationIds: ["test_destructive_no_approval"],
        toolset: "reactions",
        scope: "none",
        permissions: ["ViewChannel", "ReadMessageHistory"],
        effect: "destructive",
        idempotent: true,
        approval: false,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "Bot permissions: View Channel, Read Message History. Changes or removes existing Discord data without an approval prompt.",
      );
    });

    it("renders sentence for local_write tool", () => {
      const tool = defineTool({
        name: "discord_test_local_write",
        description: "Local write tool.",
        operationIds: ["test_local_write"],
        toolset: "messages",
        scope: "none",
        permissions: ["ViewChannel", "ReadMessageHistory"],
        effect: "local_write",
        idempotent: false,
        input: z.object({}),
        output: z.object({}),
        execute: async () => ({}),
      });
      expect(buildBehaviorSentence(tool, "elicitation")).toBe(
        "Bot permissions: View Channel, Read Message History. Writes a file to the local download folder and changes nothing in Discord.",
      );
    });
  });

  describe("buildServerInstructions", () => {
    it("matches literal text for the default config", async () => {
      const registry = await PToolRegistry.load();
      const instructions = buildServerInstructions(DEFAULT_TOOLSETS, registry.list());
      expect(instructions).toBe(
        "MCP server for the Discord REST API. Enabled toolsets: core, messages. Other available toolsets that can be enabled with DISCORD_MCP_TOOLSETS: reactions (Add, remove, list reactions on messages); threads (Create, join, leave, list and search threads, thread members); channels (Create, edit, delete channels, permission overwrites, voice status); webhooks (Create, edit, delete, execute webhooks, edit webhook messages); guild (Guild settings, audit log, onboarding, welcome screen, widget); members (List, search, update, kick, mute, deafen members, prune); roles (Create, update, delete, list guild roles, member counts); moderation (Ban, unban, list bans, AutoMod rules); events (Create, update, delete scheduled events, list subscribers); invites (Create, get, delete invites, target users). If a task needs a disabled toolset, tell the user which one to enable. IDs are snowflakes as strings, found with the list tools. When an allowlist is set, the bot only acts in the allowed guilds. When approval is on, tools whose description says the user is asked to approve ask before they run.",
      );
    });
  });
});
