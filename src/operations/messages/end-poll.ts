import { type RESTPostAPIPollExpireResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { messageIds, messageResult } from "./schemas.js";

export const endPoll = defineTool({
  name: "discord_end_poll",
  description:
    "End a poll the bot created before its duration runs out. Discord does not let a bot end polls posted by other users. Returns the message with the poll; Discord finishes the final vote count in the background, so read the final tally later with discord_get_message once poll.results.is_finalized is true.",
  operationIds: ["poll_expire"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel"],
  effect: "destructive",
  // Discord only lets the poll author end it, so this can only end the bot's own poll; no approval.
  approval: false,
  idempotent: false,
  input: z.object(messageIds),
  output: messageResult,
  execute: async (p, { discord }) => {
    const result = await discord<RESTPostAPIPollExpireResult>({
      method: "POST",
      route: Routes.expirePoll(p.channel_id, p.message_id),
    });
    return { message: result };
  },
});
