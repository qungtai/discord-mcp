import { type RESTGetAPICurrentUserGuildsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { partialGuild } from "./schemas.js";

export const listMyGuilds = defineTool({
  name: "discord_list_my_guilds",
  description:
    "List the guilds the bot is a member of. Page with after=next_after. Under DISCORD_MCP_ALLOWED_GUILDS, paging is not available; every allowed guild is returned in one call.",
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
  execute: async (query, { discord, allowsGuild, hasAllowlist }) => {
    // When an allowlist is active, scan all pages internally so no non-allowlisted ID leaks in cursors.
    if (hasAllowlist) {
      if (query.before !== undefined || query.after !== undefined || query.limit !== undefined) {
        throw new PToolError(
          "Paging is not available with DISCORD_MCP_ALLOWED_GUILDS; every allowed guild is returned in one call",
          {
            category: "validation",
            retryable: false,
            remediation: "Omit before, after and limit when DISCORD_MCP_ALLOWED_GUILDS is set",
          },
        );
      }
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
      return {
        guilds: allowedGuilds,
        next_before: null,
        next_after: null,
      };
    }

    const rawGuilds = await discord<RESTGetAPICurrentUserGuildsResult>({
      method: "GET",
      route: Routes.userGuilds(),
      query,
    });
    const guilds = rawGuilds.filter((g) => allowsGuild(g.id));
    const requestedLimit = query.limit ?? 200;
    const hasFullPage = guilds.length >= requestedLimit;
    return {
      guilds,
      next_before: hasFullPage ? (guilds.at(0)?.id ?? null) : null,
      next_after: hasFullPage ? (guilds.at(-1)?.id ?? null) : null,
    };
  },
});
