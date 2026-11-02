import { type RESTGetAPIChannelMessageResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../../core/tool-error.js";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { messageIds } from "./schemas.js";

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
