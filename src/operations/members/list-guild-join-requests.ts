import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { type JoinRequest, joinRequest, joinRequestStatus } from "./schemas.js";

interface GuildJoinRequestsResponse {
  total?: number;
  guild_join_requests: JoinRequest[];
}

export const listGuildJoinRequests = defineTool({
  name: "discord_list_guild_join_requests",
  description: "List join requests for a guild, optionally filtered by application status",
  operationIds: ["get_guild_join_requests"],
  toolset: "members",
  scope: { guild: "guild_id" },
  permissions: ["ManageGuild"],
  effect: "read",
  idempotent: true,
  output: z.object({
    guild_join_requests: z.array(joinRequest),
    total: z.number().optional(),
    next_before: snowflake.nullable(),
    next_after: snowflake.nullable(),
  }),
  input: z.object({
    guild_id: snowflake,
    status: joinRequestStatus.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    before: snowflake.optional(),
    after: snowflake.optional(),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => {
    const res = await discord<GuildJoinRequestsResponse>({
      method: "GET",
      route: `/guilds/${guild_id}/requests`,
      query,
    });
    const requests = res.guild_join_requests ?? [];
    return {
      guild_join_requests: requests,
      total: res.total,
      next_before: requests.at(-1)?.id ?? null,
      next_after: requests[0]?.id ?? null,
    };
  },
});
