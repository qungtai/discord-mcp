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
    next_before: snowflake.nullable(),
    next_after: snowflake.nullable(),
  }),
  execute: async (query, { discord, allowsGuild }) => {
    // When an allowlist is active, scan all pages internally so no non-allowlisted ID leaks in cursors.
    const hasAllowlist = !allowsGuild("__probe_guild_id_not_in_allowlist__");
    if (hasAllowlist) {
      const allowedGuilds: RESTGetAPICurrentUserGuildsResult = [];
      let cursor: string | undefined;
      while (true) {
        const page = await discord<RESTGetAPICurrentUserGuildsResult>({
          method: "GET",
          route: Routes.userGuilds(),
          query: {
            limit: 200,
            after: cursor,
            with_counts: query.with_counts,
          },
        });
        for (const g of page) {
          if (allowsGuild(g.id)) {
            allowedGuilds.push(g);
          }
        }
        if (page.length < 200) break;
        cursor = page.at(-1)?.id;
      }
      const limit = query.limit ?? allowedGuilds.length;
      return {
        guilds: allowedGuilds.slice(0, limit),
        next_before: null,
        next_after: null,
      };
    }

    const guilds = await discord<RESTGetAPICurrentUserGuildsResult>({
      method: "GET",
      route: Routes.userGuilds(),
      query,
    });
    const requestedLimit = query.limit ?? 200;
    const hasFullPage = guilds.length >= requestedLimit;
    return {
      guilds,
      next_before: hasFullPage ? (guilds.at(0)?.id ?? null) : null,
      next_after: hasFullPage ? (guilds.at(-1)?.id ?? null) : null,
    };
  },
});
