// Shared Discord schemas. Outputs require identifiers only, so a Discord response that adds,
// drops or nulls an optional field never turns a successful call into a failure. Input objects
// are strict so a misspelled nested key fails instead of being dropped.
import { AllowedMentionsTypes } from "discord-api-types/v10";
import { z } from "zod/v4";

export const snowflake = z.string().regex(/^\d+$/, "Expected a Discord snowflake");

export const user = z.object({
  id: snowflake,
  username: z.string().optional(),
  global_name: z.string().nullish(),
  bot: z.boolean().optional(),
});
export const attachment = z.object({
  id: snowflake,
  filename: z.string().optional(),
  size: z.number().optional(),
  url: z.string().optional(),
  content_type: z.string().optional(),
  description: z.string().optional(),
  title: z.string().optional(),
  flags: z.number().optional(),
});
export const message = z.object({
  id: snowflake,
  channel_id: snowflake,
  type: z.number().optional(),
  author: user.optional(),
  content: z.string().optional(),
  timestamp: z.string().optional(),
  edited_timestamp: z.string().nullish(),
  flags: z.number().optional(),
  attachments: z.array(attachment).optional(),
  embeds: z.array(z.unknown()).optional(),
  message_reference: z
    .object({
      message_id: snowflake.optional(),
      channel_id: snowflake.optional(),
      guild_id: snowflake.optional(),
    })
    .optional(),
});
export const channel = z.object({
  id: snowflake,
  type: z.number().optional(),
  guild_id: snowflake.optional(),
  name: z.string().nullish(),
  parent_id: snowflake.nullish(),
  position: z.number().optional(),
  topic: z.string().nullish(),
});
export const role = z.object({
  id: snowflake,
  name: z.string().optional(),
  color: z.number().optional(),
  position: z.number().optional(),
  permissions: z.string().optional(),
  managed: z.boolean().optional(),
});
export const member = z.object({
  user: user.optional(),
  nick: z.string().nullish(),
  roles: z.array(snowflake).optional(),
  joined_at: z.string().nullish(),
});

// No pings unless the caller opts in (FR-AUTH-07). A constant default is safe to advertise.
export const allowedMentions = z
  .strictObject({
    parse: z.array(z.enum(AllowedMentionsTypes)).optional(),
    roles: z.array(snowflake).optional(),
    users: z.array(snowflake).optional(),
    replied_user: z.boolean().optional(),
  })
  .default({ parse: [] });
export const fileUpload = z.strictObject({
  path: z.string().describe("Absolute path inside DISCORD_MCP_FILE_ROOTS"),
  filename: z.string().optional(),
  description: z.string().optional(),
  is_spoiler: z.boolean().optional(),
  title: z.string().optional(),
  content_type: z.string().optional(),
});
export const attachmentUpdate = z.strictObject({
  id: snowflake,
  description: z.string().optional(),
  is_spoiler: z.boolean().optional(),
});
// Sent as X-Audit-Log-Reason, never in the body.
export const reason = z.string().max(512).optional().describe("Audit log reason");
