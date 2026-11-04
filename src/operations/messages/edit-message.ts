import {
  type RESTGetAPIChannelMessageResult,
  type RESTPatchAPIChannelMessageResult,
  Routes,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { attachmentUpdate, fileUpload } from "../schemas.js";
import { messageBody, messageIds, messageResult } from "./schemas.js";

export const editMessage = defineTool({
  name: "discord_edit_message",
  description:
    "Edit a message previously sent by the bot: replace its content or embeds, and keep, redescribe, or remove its attachments. Discord only allows a bot to edit messages it authored; to post a new message use discord_send_message. Returns the updated message object.",
  operationIds: ["get_message", "update_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  // AttachFiles is required when adding files; EmbedLinks when adding embeds.
  permissions: ["ViewChannel", "ReadMessageHistory", "AttachFiles", "EmbedLinks"],
  // Replacing content is not additive, but editing the bot's own message needs no approval.
  effect: "destructive",
  approval: false,
  idempotent: false,
  output: messageResult,
  input: z.object({
    ...messageIds,
    ...messageBody,
    add_files: z
      .array(fileUpload)
      .optional()
      .describe("New files to upload and attach to the message"),
    update_attachments: z
      .array(attachmentUpdate)
      .optional()
      .describe(
        "List of existing attachments to retain, update descriptions for, or mark as spoilers (attachments omitted from this list are removed)",
      ),
  }),
  execute: async ({ channel_id, message_id, add_files, update_attachments, ...p }, ctx) => {
    const route = Routes.channelMessage(channel_id, message_id);
    if (!add_files && !update_attachments)
      return {
        message: await ctx.discord<RESTPatchAPIChannelMessageResult>({
          method: "PATCH",
          route,
          body: p,
        }),
      };
    const existing = await ctx.discord<RESTGetAPIChannelMessageResult>({ method: "GET", route });
    const { files, attachments } = await ctx.files.merge(existing.attachments, {
      add: add_files,
      update: update_attachments,
    });
    return {
      message: await ctx.discord<RESTPatchAPIChannelMessageResult>({
        method: "PATCH",
        route,
        body: { ...p, attachments },
        files,
      }),
    };
  },
});
