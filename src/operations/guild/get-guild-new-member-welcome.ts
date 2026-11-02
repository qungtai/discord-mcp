import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { guildIds, newMemberWelcome } from "./guild-settings-schemas.js";

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
    const res = await discord<unknown>({
      method: "GET",
      route: `/guilds/${guild_id}/new-member-welcome`,
    });
    const isEmpty =
      res == null ||
      (res instanceof ArrayBuffer && res.byteLength === 0) ||
      (typeof res === "object" && Object.keys(res).length === 0);
    return {
      new_member_welcome: isEmpty ? null : (res as z.infer<typeof newMemberWelcome>),
    };
  },
});
