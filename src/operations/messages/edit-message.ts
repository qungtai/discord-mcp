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
    "Edit a message the bot sent: replace its content or embeds, add uploaded files, and change the description or spoiler flag of existing attachments. Existing attachments are always kept; they cannot be removed with this tool. Discord only lets a bot edit its own messages; to post a new message use discord_send_message. Returns the updated message.",
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
      .describe("New local files to upload and append to the message's existing attachments"),
    update_attachments: z
      .array(attachmentUpdate)
      .optional()
      .describe(
        "Changes to existing attachments, matched by attachment ID. Attachments not listed stay unchanged, and none are removed.",
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
