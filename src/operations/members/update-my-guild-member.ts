import { type RESTPatchAPICurrentGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, reason, snowflake } from "../schemas.js";

export const updateMyGuildMember = defineTool({
  name: "discord_update_my_guild_member",
  description: "Update the current bot's nickname or member profile in a guild",
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
    guild_id: snowflake,
    nick: z.string().max(32).nullable().optional(),
    avatar: z.string().nullable().optional(),
    banner: z.string().nullable().optional(),
    bio: z.string().max(300).nullable().optional(),
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
