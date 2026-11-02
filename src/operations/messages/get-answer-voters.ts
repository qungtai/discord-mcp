import { type RESTGetAPIPollAnswerVotersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";

export const getAnswerVoters = defineTool({
  name: "discord_get_answer_voters",
  description: "Get a list of users that voted for a specific poll answer",
  operationIds: ["get_answer_voters"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    channel_id: snowflake,
    message_id: snowflake,
    answer_id: z.number().int().describe("ID of the poll answer"),
    after: snowflake.optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  output: z.object({
    users: z.array(user),
    next_after: snowflake.optional(),
  }),
  execute: async ({ channel_id, message_id, answer_id, ...query }, { discord }) => {
    const result = await discord<RESTGetAPIPollAnswerVotersResult>({
      method: "GET",
      route: Routes.pollAnswerVoters(channel_id, message_id, answer_id),
      query,
    });
    const last = result.users.at(-1);
    return {
      users: result.users,
      next_after: last?.id,
    };
  },
});
