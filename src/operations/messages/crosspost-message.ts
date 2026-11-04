import { type RESTPostAPIChannelMessageCrosspostResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { message, snowflake } from "../schemas.js";

export const crosspostMessage = defineTool({
  name: "discord_crosspost_message",
  description:
    "Publish a message posted in an announcement channel (type 5) so Discord copies it into every channel that follows that channel. Use it after posting with discord_send_message in an announcement channel; regular text channels cannot be crossposted, and a message can be published only once, so a second call fails. Manage Messages is only needed for messages the bot did not send. Returns the published message.",
  operationIds: ["crosspost_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "SendMessages", "ManageMessages"],
  effect: "write",
  idempotent: false,
  output: z.object({ message }),
  input: z.object({
    channel_id: snowflake.describe(
      "ID of the announcement channel (type 5) that holds the message",
    ),
    message_id: snowflake.describe("ID of the message to publish to following channels"),
  }),
  execute: async ({ channel_id, message_id }, { discord }) => ({
    message: await discord<RESTPostAPIChannelMessageCrosspostResult>({
      method: "POST",
      route: Routes.channelMessageCrosspost(channel_id, message_id),
    }),
  }),
});
