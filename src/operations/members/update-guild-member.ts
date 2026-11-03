import { type RESTPatchAPIGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, reason, snowflake } from "../schemas.js";

export const updateGuildMember = defineTool({
  name: "discord_update_guild_member",
  description:
    "Update attributes of a guild member. Note: moving to a voice channel requires channel_id (null/voice disconnect is unsupported until scope allowlist supports null values)",
  operationIds: ["update_guild_member"],
  toolset: "members",
  scope: { guild: "guild_id", channel: "channel_id" },
  permissions: [
    "ManageNicknames",
    "ManageRoles",
    "MuteMembers",
    "DeafenMembers",
    "MoveMembers",
    "ModerateMembers",
  ],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    member,
  }),
  input: z.object({
    guild_id: snowflake,
    user_id: snowflake,
    nick: z.string().max(32).nullable().optional(),
    roles: z.array(snowflake).max(350).nullable().optional(),
    mute: z.boolean().nullable().optional(),
    deaf: z.boolean().nullable().optional(),
    channel_id: snowflake.optional(),
    communication_disabled_until: z.iso.datetime().nullable().optional(),
    flags: z.number().int().nullable().optional(),
    reason,
  }),
  execute: async ({ guild_id, user_id, reason, ...body }, { discord }) => ({
    member: await discord<RESTPatchAPIGuildMemberResult>({
      method: "PATCH",
      route: Routes.guildMember(guild_id, user_id),
      body,
      reason,
    }),
  }),
});
