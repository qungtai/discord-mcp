import { randomBytes } from "node:crypto";
import { type RESTPostAPIChannelMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { fileUpload, messageFlags, snowflake } from "../schemas.js";
import { messageBody, messageResult, poll } from "./schemas.js";

export const sendMessage = defineTool({
  name: "discord_send_message",
  description:
    "Send a message to a channel or thread. It can carry text, embeds, a poll, files from the local machine, a reply to an existing message, stickers (up to 3) and flags (suppress embeds, silent). At least one of content, embeds, sticker_ids, files or poll is required. Mentions do not ping unless allowed_mentions permits it. To change a message already sent use discord_edit_message. A retry without the same nonce posts a second message.",
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
      "Message flags bitfield. 4 suppresses link embeds, 4096 sends without push or desktop notifications; add them to set both (4100). No other flags are accepted.",
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
