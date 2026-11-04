import { type RESTPatchAPICurrentGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, reason, snowflake } from "../schemas.js";

export const updateMyGuildMember = defineTool({
  name: "discord_update_my_guild_member",
  description:
    "Update the bot's own nickname or server profile attributes in a specific guild. Returns the updated member object. To update attributes of other guild members instead, use discord_update_guild_member. To update the bot's global user profile, use discord_update_my_user.",
  operationIds: ["update_my_guild_member"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["ChangeNickname"],
  effect: "destructive",
  // Editing the bot's own member profile is safe without approval.
  approval: false,
  idempotent: true,
  output: z.object({
    member,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    nick: z
      .string()
      .max(32)
      .nullable()
      .optional()
      .describe("New nickname for the bot in this guild (max 32 characters), or null to clear"),
    avatar: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Guild avatar as a data URI, for example data:image/png;base64,AAAA, or null to remove it",
      ),
    banner: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Guild banner as a data URI, for example data:image/png;base64,AAAA, or null to remove it",
      ),
    bio: z.string().max(300).nullable().optional().describe("Guild bio text, or null to clear"),
    reason,
  }),
  execute: async ({ guild_id, reason, ...body }, { discord }) => ({
    member: await discord<RESTPatchAPICurrentGuildMemberResult>({
      method: "PATCH",
      route: Routes.guildMember(guild_id, "@me"),
      body,
      reason,
    }),
  }),
});
