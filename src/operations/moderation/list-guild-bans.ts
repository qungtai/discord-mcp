import { type RESTGetAPIGuildBansResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { ban } from "./schemas.js";

export const listGuildBans = defineTool({
  name: "discord_list_guild_bans",
  description:
    "List banned users for a guild, ordered by user ID ascending. Returns ban objects with user details and reasons. Page with after=next_after. To look up a single user ban directly, use discord_get_guild_ban. To remove a ban, use discord_unban_user_from_guild.",
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
    guild_id: snowflake.describe("ID of the guild"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Max number of bans to return (1-1000, default 1000)"),
    before: snowflake
      .optional()
      .describe("User ID cursor to fetch bans before; use for descending pagination"),
    after: snowflake
      .optional()
      .describe(
        "User ID cursor to fetch bans after; use next_after from previous page for ascending pagination",
      ),
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
