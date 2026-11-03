import { randomBytes } from "node:crypto";
import { type RESTPostAPIChannelMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { fileUpload, messageFlags, snowflake } from "../schemas.js";
import { messageBody, messageResult, poll } from "./schemas.js";

export const sendMessage = defineTool({
  name: "discord_send_message",
  description: "Send a message",
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
    channel_id: snowflake,
    ...messageBody,
    // Replies only: the referenced message is looked up in channel_id, so it needs no scope.
    message_reference: z
      .strictObject({
        message_id: snowflake,
        fail_if_not_exists: z.boolean().optional(),
      })
      .optional(),
    files: z.array(fileUpload).default([]),
    poll: poll.optional(),
    tts: z.boolean().optional(),
    flags: messageFlags,
    sticker_ids: z.array(snowflake).max(3).optional(),
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
