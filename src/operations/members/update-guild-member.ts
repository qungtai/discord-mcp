import { type RESTPatchAPIGuildMemberResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { member, reason, snowflake } from "../schemas.js";

export const updateGuildMember = defineTool({
  name: "discord_update_guild_member",
  description:
    "Update attributes of a guild member including nickname, roles, mute/deaf state, voice channel and timeout. The bot cannot edit the guild owner or members whose highest role is equal to or higher than the bot's highest role. Discord refuses edits to the bot itself here; use discord_update_my_guild_member to change the bot's own nickname.",
  operationIds: ["update_guild_member"],
  toolset: "members",
  scope: { guild: "guild_id", channel: "channel_id" },
  // Connect is required when moving a member with channel_id to a voice channel.
  permissions: [
    "ManageNicknames",
    "ManageRoles",
    "MuteMembers",
    "DeafenMembers",
    "MoveMembers",
    "ModerateMembers",
    "Connect",
  ],
  effect: "destructive",
  idempotent: true,
  output: z.object({
    member,
  }),
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    user_id: snowflake.describe("ID of the member to update"),
    nick: z
      .string()
      .max(32)
      .nullable()
      .optional()
      .describe("New guild nickname for the member (max 32 characters), or null to reset"),
    roles: z
      .array(snowflake)
      .max(350)
      .nullable()
      .optional()
      .describe(
        "Complete array of role IDs to assign to the member, replacing existing roles; requires ManageRoles",
      ),
    mute: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether to server-mute the member in voice channels; requires MuteMembers"),
    deaf: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether to server-deafen the member in voice channels; requires DeafenMembers"),
    channel_id: snowflake
      .nullish()
      .describe(
        "ID of the voice channel to move the member to, or null to disconnect them from voice; requires MoveMembers",
      ),
    communication_disabled_until: z.iso
      .datetime()
      .nullable()
      .optional()
      .describe(
        "ISO 8601 timestamp up to 28 days in the future to timeout the member, or null to remove timeout; requires ModerateMembers",
      ),
    flags: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(
        "Guild member flags bitfield (e.g. 1=DID_REJOIN, 2=COMPLETED_ONBOARDING, 4=BYPASSES_VERIFICATION)",
      ),
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
