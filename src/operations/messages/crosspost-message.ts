import { type RESTPostAPIChannelMessageCrosspostResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { message } from "../schemas.js";
import { messageIds } from "./schemas.js";

export const crosspostMessage = defineTool({
  name: "discord_crosspost_message",
  description:
    "Publish a message from an announcement channel (type 5) to every channel that follows it. Regular text channels cannot be crossposted. Returns the message.",
  operationIds: ["crosspost_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "SendMessages", "ManageMessages"],
  effect: "write",
  idempotent: false,
  output: z.object({ message }),
  input: z.object(messageIds),
  execute: async ({ channel_id, message_id }, { discord }) => ({
    message: await discord<RESTPostAPIChannelMessageCrosspostResult>({
      method: "POST",
      route: Routes.channelMessageCrosspost(channel_id, message_id),
    }),
  }),
});
