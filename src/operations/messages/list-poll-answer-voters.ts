import { type RESTGetAPIPollAnswerVotersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake, user } from "../schemas.js";
import { messageIds } from "./schemas.js";

export const listPollAnswerVoters = defineTool({
  name: "discord_list_poll_answer_voters",
  description:
    "Get a paginated list of users that voted for a specific answer on a poll message. Use it after fetching a poll message with discord_get_message to see who selected each answer. Page subsequent voters with after=next_after.",
  operationIds: ["get_answer_voters"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...messageIds,
    answer_id: z
      .number()
      .int()
      .min(1)
      .describe(
        "ID of the poll answer to list voters for (answer_id is poll.answers[].answer_id on the message from discord_get_message)",
      ),
    after: snowflake
      .optional()
      .describe("User snowflake ID cursor to fetch voters after (use next_after)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max number of voters to return (1-100; default is 25)"),
  }),
  output: z.object({
    users: z.array(user),
    next_after: snowflake.nullable(),
  }),
  execute: async ({ channel_id, message_id, answer_id, ...query }, { discord }) => {
    const result = await discord<RESTGetAPIPollAnswerVotersResult>({
      method: "GET",
      route: Routes.pollAnswerVoters(channel_id, message_id, answer_id),
      query,
    });
    return {
      users: result.users,
      next_after: result.users.at(-1)?.id ?? null,
    };
  },
});
