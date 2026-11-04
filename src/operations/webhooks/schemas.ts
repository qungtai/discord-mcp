import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import type { DiscordRequest } from "../../core/ports.js";
import { PToolError } from "../../core/tool-error.js";
import { resource, sanitizeWebhook, snowflake, user } from "../schemas.js";

export const webhook = resource(
  z.looseObject({
    id: snowflake,
    type: z.number().optional(),
    guild_id: snowflake.nullish(),
    channel_id: snowflake.nullish(),
    user: user.optional(),
    name: z.string().nullish(),
    avatar: z.string().nullish(),
    application_id: snowflake.nullish(),
    source_guild: z.unknown().optional(),
    source_channel: z.unknown().optional(),
  }),
);

export { sanitizeWebhook };

export const resolveWebhookToken = async (
  webhookId: string,
  discord: DiscordRequest,
): Promise<string> => {
  const data = await discord<{ token?: string | null }>({
    method: "GET",
    route: Routes.webhook(webhookId),
  });
  if (!data.token) {
    throw new PToolError("Webhook has no token", {
      category: "validation",
      retryable: false,
      remediation: "Only incoming webhooks can post; create one with discord_create_webhook",
    });
  }
  return data.token;
};

export const webhookAllowedMentions = z
  .strictObject({
    parse: z
      .array(z.enum(["everyone", "roles", "users"]))
      .optional()
      .describe(
        "Mention types Discord may resolve: roles, users, everyone. An empty array (the default) pings nobody.",
      ),
    roles: z
      .array(snowflake)
      .optional()
      .describe(
        "Role IDs allowed to be pinged. Do not combine with roles in parse; Discord rejects the request.",
      ),
    users: z
      .array(snowflake)
      .optional()
      .describe(
        "User IDs allowed to be pinged. Do not combine with users in parse; Discord rejects the request.",
      ),
    replied_user: z
      .boolean()
      .optional()
      .describe("Whether to ping the author of the replied-to message."),
  })
  .default({ parse: [] })
  .describe("Allowed mentions object controlling user, role, or everyone pings");

export const webhookFileUpload = z
  .strictObject({
    path: z
      .string()
      .describe(
        "Absolute path of the file to upload. Hidden files and folders are refused unless DISCORD_MCP_FILE_ROOTS is set",
      ),
    filename: z
      .string()
      .optional()
      .describe(
        "Name shown in Discord for the uploaded file. Defaults to the name of the local file.",
      ),
    description: z.string().optional().describe("Alt text for the attachment."),
    is_spoiler: z.boolean().optional().describe("Whether to mark the attachment as a spoiler."),
    title: z.string().optional().describe("Title shown for the attachment."),
    content_type: z
      .string()
      .optional()
      .describe("MIME type of the file. Detected from the file when omitted."),
  })
  .describe("Local file attachment descriptor to upload");

export const webhookAttachmentUpdate = z
  .strictObject({
    id: snowflake.describe("ID of an existing attachment on the message to keep."),
    description: z.string().optional().describe("New alt text for the kept attachment."),
    is_spoiler: z
      .boolean()
      .optional()
      .describe("Whether the kept attachment is marked as a spoiler."),
  })
  .describe("Attachment update descriptor for kept or modified attachments");

const webhookPollEmoji = z
  .strictObject({
    id: snowflake.optional().describe("ID of a custom emoji. Provide id or name."),
    name: z.string().min(1).optional().describe("Unicode emoji character. Provide id or name."),
  })
  .refine((media) => media.id !== undefined || media.name !== undefined, {
    message: "Provide id or name",
  });

export const webhookPoll = z
  .strictObject({
    question: z
      .strictObject({
        text: z.string().min(1).max(300).describe("Question text, 1 to 300 characters."),
      })
      .describe("Poll question."),
    answers: z
      .array(
        z
          .strictObject({
            poll_media: z
              .strictObject({
                text: z.string().min(1).max(55).describe("Answer text, 1 to 55 characters."),
                emoji: webhookPollEmoji
                  .optional()
                  .describe("Optional emoji shown beside the answer."),
              })
              .describe("Content of one answer."),
          })
          .describe("Poll answer option"),
      )
      .min(1)
      .max(10)
      .describe("Answer options for the poll."),
    duration: z.number().int().min(1).max(768).optional().describe("Poll duration in hours"),
    allow_multiselect: z
      .boolean()
      .optional()
      .describe("Whether voters may pick more than one answer. Defaults to false."),
    layout_type: z.literal(1).optional().describe("1 for the default poll layout"),
  })
  .describe("Poll object to attach to the webhook message");
