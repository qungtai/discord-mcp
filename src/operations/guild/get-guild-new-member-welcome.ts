import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, newMemberWelcome } from "./schemas.js";

export const getGuildNewMemberWelcome = defineTool({
  name: "discord_get_guild_new_member_welcome",
  description:
    "Retrieve the new member welcome experience (Home tab settings) for a guild. This feature requires Community to be enabled on the guild. To inspect full onboarding questions use discord_get_guild_onboarding, or use discord_get_guild_welcome_screen for legacy welcome screens. Returns welcome settings or null when unconfigured.",
  operationIds: ["get_guild_new_member_welcome"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  input: z.object(guildIds),
  output: z.object({ new_member_welcome: newMemberWelcome.nullable() }),
  execute: async ({ guild_id }, { discord }) => {
    const res = await discord<z.infer<typeof newMemberWelcome> | null>({
      method: "GET",
      route: `/guilds/${guild_id}/new-member-welcome`,
    });
    // Discord answers 204 with an empty body when the guild has no welcome settings.
    const isEmpty = res === null || Object.keys(res).length === 0;
    return { new_member_welcome: isEmpty ? null : res };
  },
});
