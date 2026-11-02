import { type RESTGetAPIGuildBansResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { ban } from "./schemas.js";

export const listGuildBans = defineTool({
  name: "discord_list_guild_bans",
  description: "List bans in ascending user ID order. Page with after=next_after",
  operationIds: ["list_guild_bans"],
  toolset: "moderation",
  scope: { guild: "guild_id" },
  permissions: ["BanMembers"],
  effect: "read",
  idempotent: true,
  output: z.object({
    bans: z.array(ban),
    next_after: snowflake.nullable(),
  }),
  input: z.object({
    guild_id: snowflake,
    limit: z.number().int().min(1).max(1000).optional(),
    before: snowflake.optional(),
    after: snowflake.optional(),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => {
    const bans = await discord<RESTGetAPIGuildBansResult>({
      method: "GET",
      route: Routes.guildBans(guild_id),
      query,
    });
    return {
      bans,
      next_after: bans.at(-1)?.user.id ?? null,
    };
  },
});
