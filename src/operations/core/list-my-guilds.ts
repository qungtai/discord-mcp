import { type RESTGetAPICurrentUserGuildsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { partialGuild } from "./schemas.js";

export const listMyGuilds = defineTool({
  name: "discord_list_my_guilds",
  description: "List the guilds the bot is a member of. Page with after=next_after",
  operationIds: ["list_my_guilds"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    before: snowflake.optional(),
    after: snowflake.optional(),
    limit: z.number().int().min(1).max(200).optional(),
    with_counts: z.boolean().optional(),
  }),
  output: z.object({
    guilds: z.array(partialGuild),
    next_after: snowflake.nullable(),
  }),
  execute: async (query, { discord, allowsGuild }) => {
    const guilds = await discord<RESTGetAPICurrentUserGuildsResult>({
      method: "GET",
      route: Routes.userGuilds(),
      query,
    });
    const next_after = guilds.at(-1)?.id ?? null;
    return {
      guilds: guilds.filter((g) => allowsGuild(g.id)),
      next_after,
    };
  },
});
