import { randomBytes } from "node:crypto";
import { type RESTPostAPIChannelMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { fileUpload, messageFlags, snowflake } from "../schemas.js";
import { messageBody, messageResult, poll } from "./schemas.js";

export const sendMessage = defineTool({
  name: "discord_send_message",
  description:
    "Send a new message to a channel or thread. Supports text content, rich embeds, interactive polls, local file uploads, replies to existing messages, stickers, and delivery flags (such as suppressing embeds or silent notifications without push pings). To modify an existing message instead use discord_edit_message.",
  operationIds: ["create_message"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  // AttachFiles: files; EmbedLinks: embeds; SendPolls: polls; SendTTSMessages: tts;
  // ReadMessageHistory: reply; SendMessagesInThreads: thread; UseExternalStickers: sticker_ids;
  // MentionEveryone: only needed to ping @everyone or @here.
  permissions: [
    "ViewChannel",
    "SendMessages",
    "AttachFiles",
    "EmbedLinks",
    "SendPolls",
    "SendTTSMessages",
    "ReadMessageHistory",
    "SendMessagesInThreads",
    "UseExternalStickers",
    "MentionEveryone",
  ],
  effect: "write",
  idempotent: false,
  output: messageResult,
  input: z.object({
    channel_id: snowflake.describe("ID of the channel or thread to send the message in"),
    ...messageBody,
    // Replies only: the referenced message is looked up in channel_id, so it needs no scope.
    message_reference: z
      .strictObject({
        message_id: snowflake.describe("ID of the original message being replied to"),
        fail_if_not_exists: z
          .boolean()
          .optional()
          .describe(
            "Whether to fail sending if the referenced message does not exist (default true)",
          ),
      })
      .optional()
      .describe("Message reference object for replying to an earlier message"),
    files: z.array(fileUpload).default([]).describe("Local files to upload as message attachments"),
    poll: poll.optional(),
    tts: z
      .boolean()
      .optional()
      .describe("Whether this message should be spoken using text-to-speech (default false)"),
    flags: messageFlags.describe(
      "Message flags bitfield (e.g. 4096 for SUPPRESS_EMBEDDS, 4096 to suppress notifications silent)",
    ),
    sticker_ids: z
      .array(snowflake.describe("Sticker snowflake ID"))
      .max(3)
      .optional()
      .describe("Array of up to 3 sticker IDs to attach to the message"),
    nonce: z
      .string()
      .max(25)
      .optional()
      .describe("Pass the nonce from an uncertain result to retry without a duplicate"),
  }),
  execute: async ({ channel_id, files: uploads, ...p }, { discord, files }) => {
    const { files: raw, attachments } = await files.prepare(uploads);
    return {
      message: await discord<RESTPostAPIChannelMessageResult>({
        method: "POST",
        route: Routes.channelMessages(channel_id),
        body: {
          ...p,
          nonce: p.nonce ?? randomBytes(12).toString("hex"),
          enforce_nonce: true,
          attachments,
        },
        files: raw,
      }),
    };
  },
});
