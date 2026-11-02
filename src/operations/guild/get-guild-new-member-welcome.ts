import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, newMemberWelcome } from "./schemas.js";

export const getGuildNewMemberWelcome = defineTool({
  name: "discord_get_guild_new_member_welcome",
  description: "Get new member welcome (home settings) for a guild",
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
