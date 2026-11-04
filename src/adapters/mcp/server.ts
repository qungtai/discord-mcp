import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { PToolPipeline } from "../../core/pipeline.js";
import type { ApprovalMode } from "../../core/policy.js";
import { TOOLSETS, type ToolDescriptor, type Toolset } from "../../core/tool-registry.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };

const PERMISSION_NAME_OVERRIDES: Record<string, string> = {
  ManageGuild: "Manage Server",
  CreateInstantInvite: "Create Invite",
  ModerateMembers: "Timeout Members",
  ManageGuildExpressions: "Manage Expressions",
  SendMessagesInThreads: "Send Messages in Threads",
  MentionEveryone: "Mention Everyone",
};

export function formatPermissionName(permission: string): string {
  if (PERMISSION_NAME_OVERRIDES[permission]) {
    return PERMISSION_NAME_OVERRIDES[permission];
  }
  return permission
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

export function buildBehaviorSentence(tool: ToolDescriptor, approvalMode: ApprovalMode): string {
  let permsPart: string;
  if (!tool.permissions.length) {
    permsPart = "No special bot permissions.";
  } else {
    const formatted = tool.permissions.map(formatPermissionName).join(", ");
    permsPart = `Bot permissions (some only for the options used): ${formatted}.`;
  }

  let effectPart: string;
  switch (tool.effect) {
    case "read":
      effectPart = "Read-only; safe to retry.";
      break;
    case "write": {
      const base = tool.idempotent
        ? "Changes Discord data; safe to retry."
        : "Changes Discord data and is not idempotent; check the result before retrying.";
      const approvalNotice =
        tool.approval && approvalMode === "elicitation"
          ? " The user is asked to approve the exact change before it runs."
          : "";
      effectPart = `${base}${approvalNotice}`;
      break;
    }
    case "destructive":
      if (tool.approval && approvalMode === "elicitation") {
        effectPart = "Destructive: the user is asked to approve the exact change before it runs.";
      } else {
        effectPart = "Changes or removes existing Discord data without an approval prompt.";
      }
      break;
    case "local_write":
      effectPart = "Writes a file to the local download folder and changes nothing in Discord.";
      break;
  }

  return `${permsPart} ${effectPart}`;
}

export const TOOLSET_SUMMARIES: Record<string, string> = {
  core: "Bot user, user lookup, guild list and leave",
  messages: "Send, get, edit, delete, pin, search messages",
  reactions: "Add, remove, list reactions on messages",
  threads: "Create, join, leave, list and search threads, thread members",
  channels: "Create, edit, delete channels, permission overwrites, voice status",
  webhooks: "Create, edit, delete, execute webhooks, edit webhook messages",
  guild: "Guild settings, audit log, onboarding, welcome screen, widget",
  members: "List, search, update, kick, mute, deafen members, prune",
  roles: "Create, update, delete, list guild roles, member counts",
  moderation: "Ban, unban, list bans, AutoMod rules",
  events: "Create, update, delete scheduled events, list subscribers",
  invites: "Create, get, delete invites, target users",
};

export function buildServerInstructions(
  enabledToolsets: readonly Toolset[],
  allTools: readonly ToolDescriptor[],
): string {
  const enabledSet = new Set(enabledToolsets);
  const toolsetsWithTools = new Set(allTools.map((t) => t.toolset));

  const otherToolsets = TOOLSETS.filter((ts) => !enabledSet.has(ts) && toolsetsWithTools.has(ts));

  const otherSummaries = otherToolsets
    .map((ts) => `${ts} (${TOOLSET_SUMMARIES[ts] ?? "Discord operations"})`)
    .join("; ");

  let otherPart = "";
  if (otherSummaries) {
    otherPart = ` Other available toolsets that can be enabled with DISCORD_MCP_TOOLSETS: ${otherSummaries}. If a task needs a disabled toolset, tell the user which one to enable.`;
  }

  return (
    `MCP server for the Discord REST API. Enabled toolsets: ${enabledToolsets.join(", ")}.${otherPart} ` +
    `IDs are snowflakes passed as strings. Guild IDs come from discord_list_my_guilds; channel IDs come from the user, from message results such as discord_search_guild_messages, or from discord_list_guild_channels when the channels toolset is enabled. ` +
    `When DISCORD_MCP_ALLOWED_GUILDS is set, tools that target a guild, channel or message refuse targets outside those guilds, and DMs are refused unless DISCORD_MCP_ALLOW_DMS=true; account tools such as discord_get_user and discord_update_my_user are not limited by it. ` +
    `When approval is on, tools whose description says the user is asked to approve ask before they run. ` +
    `If the client cannot show approval prompts, those tools fail until the operator sets DISCORD_MCP_APPROVAL=none. ` +
    `Reading message text with discord_get_message, discord_list_messages or discord_search_guild_messages needs the Message Content privileged intent; without it Discord returns empty content, embeds, attachments and polls except in DMs, the bot's own messages and messages that mention the bot.`
  );
}

// Low-level server so input validation runs in the pipeline and fails with the structured shape.
export function createServer(pipeline: PToolPipeline): Server {
  const allRegisteredTools = pipeline.registry.list();
  const instructions = buildServerInstructions(pipeline.policy.toolsets, allRegisteredTools);

  const server = new Server(
    { name: "discord-mcp", version: pkg.version },
    {
      capabilities: { tools: {}, logging: {} },
      instructions,
    },
  );
  const tools = pipeline.tools().map((tool) => ({
    name: tool.name,
    description: `${tool.description} ${buildBehaviorSentence(tool, pipeline.policy.approval)}`,
    inputSchema: toJsonSchemaCompat(tool.input) as { type: "object" },
    outputSchema: toJsonSchemaCompat(tool.output) as { type: "object" },
    annotations: tool.annotations,
  }));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const progressToken = request.params._meta?.progressToken;
    const hasElicitation = Boolean(server.getClientCapabilities()?.elicitation?.form);
    const approve = hasElicitation
      ? async (message: string) => {
          const result = await server.elicitInput(
            {
              message,
              requestedSchema: {
                type: "object",
                properties: { approve: { type: "boolean", title: "Approve this change" } },
                required: ["approve"],
              },
            },
            {
              signal: extra.signal,
              relatedRequestId: extra.requestId,
              timeout: 10 * 60_000,
            },
          );
          return result.action === "accept" && result.content?.approve === true;
        }
      : undefined;
    const result = await pipeline.call(request.params.name, request.params.arguments, {
      signal: extra.signal,
      approve,
      progress: async (progress, total) => {
        if (progressToken !== undefined)
          await extra.sendNotification({
            method: "notifications/progress",
            params: { progressToken, progress, total },
          });
      },
      log: (level, data) =>
        server.sendLoggingMessage({ level, logger: request.params.name, data }, extra.sessionId),
    });
    // Clients validate structuredContent against outputSchema even on errors, so errors are text only.
    if (!result.ok)
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: result.error }) }],
      };
    return {
      content: [{ type: "text", text: JSON.stringify(result.data) }],
      structuredContent: result.data,
    };
  });
  return server;
}
