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
  description:
    "List membership screening join requests for a guild, optionally filtered by application status. Returns join requests with applicant user details and total count. Page older requests with before=next_before or newer with after=next_after. To approve or reject a request, use discord_review_guild_join_request.",
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
    guild_id: snowflake.describe("ID of the guild"),
    status: joinRequestStatus
      .optional()
      .describe("Filter by application status: STARTED, SUBMITTED, REJECTED, or APPROVED"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max number of join requests to return (1-100, default 50)"),
    before: snowflake
      .optional()
      .describe(
        "Request ID cursor to page older requests before; use next_before from previous page",
      ),
    after: snowflake
      .optional()
      .describe(
        "Request ID cursor to page newer requests after; use next_after from previous page",
      ),
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
