import { randomBytes } from "node:crypto";
import {
  type RESTGetAPIChannelMessageResult,
  type RESTGetAPIChannelMessagesResult,
  type RESTPatchAPIChannelMessageResult,
  type RESTPostAPIChannelMessageResult,
  Routes,
} from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { allowedMentions, attachmentUpdate, fileUpload, message, snowflake } from "../schemas.js";

const messageIds = { channel_id: snowflake, message_id: snowflake };
const body = {
  content: z.string().optional(),
  embeds: z.array(z.record(z.string(), z.unknown())).optional(),
  allowed_mentions: allowedMentions,
};
const messageResult = z.object({ message });

export const sendMessage = defineTool({
  name: "discord_send_message",
  description: "Send a message",
  operationIds: ["create_message"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel", "SendMessages"],
  effect: "write",
  idempotent: false,
  output: messageResult,
  input: z.object({
    channel_id: snowflake,
    ...body,
    message_reference: z
      .strictObject({
        message_id: snowflake,
        channel_id: snowflake.optional(),
        guild_id: snowflake.optional(),
        fail_if_not_exists: z.boolean().optional(),
      })
      .optional(),
    files: z.array(fileUpload).default([]),
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
export const editMessage = defineTool({
  name: "discord_edit_message",
  description: "Edit a message's content, embeds and attachment metadata, or add attachments",
  operationIds: ["get_message", "update_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  // Replacing content is not additive, but editing the bot's own message needs no approval.
  effect: "destructive",
  approval: false,
  idempotent: false,
  output: messageResult,
  input: z.object({
    ...messageIds,
    ...body,
    add_files: z.array(fileUpload).optional(),
    update_attachments: z.array(attachmentUpdate).optional(),
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
export const getMessage = defineTool({
  name: "discord_get_message",
  description: "Get a message",
  operationIds: ["get_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  output: messageResult,
  input: z.object(messageIds),
  execute: async (p, { discord }) => ({
    message: await discord<RESTGetAPIChannelMessageResult>({
      method: "GET",
      route: Routes.channelMessage(p.channel_id, p.message_id),
    }),
  }),
});
export const listMessages = defineTool({
  name: "discord_list_messages",
  description: "List messages, newest first. Page with before=next_before",
  operationIds: ["list_messages"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  output: z.object({
    messages: z.array(message),
    next_before: snowflake.nullable(),
    next_after: snowflake.nullable(),
  }),
  input: z.object({
    channel_id: snowflake,
    limit: z.number().int().min(1).max(100).optional(),
    before: snowflake.optional(),
    after: snowflake.optional(),
    around: snowflake.optional(),
  }),
  execute: async ({ channel_id, ...query }, { discord }) => {
    const messages = await discord<RESTGetAPIChannelMessagesResult>({
      method: "GET",
      route: Routes.channelMessages(channel_id),
      query,
    });
    return {
      messages,
      next_before: messages.at(-1)?.id ?? null,
      next_after: messages[0]?.id ?? null,
    };
  },
});
export const downloadAttachment = defineTool({
  name: "discord_download_attachment",
  description: "Download a message attachment into DISCORD_MCP_DOWNLOAD_DIR",
  operationIds: ["get_message"],
  toolset: "messages",
  scope: { channel: "channel_id", message: "message_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "local_write",
  idempotent: false,
  output: z.object({
    path: z.string(),
    attachment_id: snowflake,
    filename: z.string(),
    size: z.number(),
    content_type: z.string().nullable(),
    sha256: z.string(),
  }),
  input: z.object({ ...messageIds, attachment_id: snowflake }),
  execute: async (p, { discord, files }) => {
    const { attachments } = await discord<RESTGetAPIChannelMessageResult>({
      method: "GET",
      route: Routes.channelMessage(p.channel_id, p.message_id),
    });
    const attachment = attachments.find((a) => a.id === p.attachment_id);
    if (!attachment)
      throw new PToolError("Attachment not found", {
        category: "not_found",
        retryable: false,
        remediation: "Choose an existing attachment",
        resourceIds: { attachment_id: p.attachment_id },
      });
    const filename = `${p.message_id}-${attachment.id}-${attachment.filename}`;
    return {
      ...(await files.download(attachment.url, filename)),
      attachment_id: attachment.id,
      filename,
      content_type: attachment.content_type ?? null,
    };
  },
});
