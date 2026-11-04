// Shared Discord schemas. Outputs require identifiers only, so a Discord response that adds,
// drops or nulls an optional field never turns a successful call into a failure. Resource outputs
// are loose objects so every field Discord sends reaches the caller. Input objects are strict so
// a misspelled nested key fails instead of being dropped.
import { AllowedMentionsTypes, MessageFlags } from "discord-api-types/v10";
import { z } from "zod/v4";
import { PToolError } from "../core/tool-error.js";

export const snowflake = z
  .string()
  .regex(/^\d+$/, "Expected a Discord snowflake")
  .describe("Discord snowflake ID as a numeric string");

export const codeParam = (name: string) =>
  z
    .string()
    .regex(/^[\w-]+$/, `Expected a ${name} code without path segments`)
    .describe(`${name} code or vanity slug without URL path segments`);

export const dataUri = z
  .string()
  .regex(/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/, "Expected a base64 data URI")
  .describe(
    "Image payload formatted as an RFC 2397 base64 data URI (data:image/{png|jpeg|gif|webp};base64,...)",
  );

export const messageFlags = z
  .number()
  .int()
  .min(0)
  .refine(
    (flags) => (flags & ~(MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications)) === 0,
    {
      message: "Only SUPPRESS_EMBEDS (4) and SUPPRESS_NOTIFICATIONS (4096) are supported",
    },
  )
  .optional()
  .describe(
    "Message flags bitfield integer; only SUPPRESS_EMBEDS (4) and SUPPRESS_NOTIFICATIONS (4096) are supported",
  );

// A Discord response interface has no index signature, so it does not satisfy a loose object type.
// Widening the input type keeps every field typed on output and lets tools return Discord types
// without casts.
export const resource = <T extends z.ZodTypeAny>(schema: T): z.ZodType<z.output<T>, unknown> =>
  schema as z.ZodType<z.output<T>, unknown>;

export const user = resource(
  z.looseObject({
    id: snowflake,
    username: z.string().optional(),
    global_name: z.string().nullish(),
    bot: z.boolean().optional(),
  }),
);
export const attachment = resource(
  z.looseObject({
    id: snowflake,
    filename: z.string().optional(),
    size: z.number().optional(),
    url: z.string().optional(),
    content_type: z.string().optional(),
    description: z.string().optional(),
    title: z.string().optional(),
    flags: z.number().optional(),
  }),
);
export const message = resource(
  z.looseObject({
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
      .looseObject({
        message_id: snowflake.optional(),
        channel_id: snowflake.optional(),
        guild_id: snowflake.optional(),
      })
      .optional(),
  }),
);
export const channelObject = z.looseObject({
  id: snowflake,
  type: z.number().optional(),
  guild_id: snowflake.optional(),
  name: z.string().nullish(),
  parent_id: snowflake.nullish(),
  position: z.number().optional(),
  topic: z.string().nullish(),
});
export const channel = resource(channelObject);
export const roleObject = z.looseObject({
  id: snowflake,
  name: z.string().optional(),
  color: z.number().optional(),
  position: z.number().optional(),
  permissions: z.string().optional(),
  managed: z.boolean().optional(),
});
export const role = resource(roleObject);
export const member = resource(
  z.looseObject({
    user: user.optional(),
    nick: z.string().nullish(),
    roles: z.array(snowflake).optional(),
    joined_at: z.string().nullish(),
  }),
);

// Outgoing mentions default to no pings unless requested. A constant default is safe to advertise.
export const allowedMentions = z
  .strictObject({
    parse: z
      .array(z.enum(AllowedMentionsTypes))
      .optional()
      .describe(
        "Allowed mention types to parse from message text: 'roles', 'users', or 'everyone'",
      ),
    roles: z
      .array(snowflake)
      .optional()
      .describe("Array of role IDs that can be mentioned in message content (up to 100)"),
    users: z
      .array(snowflake)
      .optional()
      .describe("Array of user IDs that can be mentioned in message content (up to 100)"),
    replied_user: z
      .boolean()
      .optional()
      .describe("Whether to mention the author of the message being replied to; defaults to false"),
  })
  .default({ parse: [] })
  .describe(
    "Allowed mentions object controlling which users and roles receive ping notifications; defaults to no pings",
  );

export const fileUpload = z
  .strictObject({
    path: z
      .string()
      .describe(
        "Absolute path of the file to upload. Hidden files and folders are refused unless DISCORD_MCP_FILE_ROOTS is set",
      ),
    filename: z
      .string()
      .optional()
      .describe("Override filename sent to Discord; defaults to the basename of path"),
    description: z
      .string()
      .optional()
      .describe("Accessibility alt-text description for the attachment (up to 1024 characters)"),
    is_spoiler: z
      .boolean()
      .optional()
      .describe(
        "Whether to mark attachment as a spoiler by prefixing filename with SPOILER_; defaults to false",
      ),
    title: z.string().optional().describe("Display title for the uploaded file"),
    content_type: z
      .string()
      .optional()
      .describe("MIME content type of the file; inferred from extension when omitted"),
  })
  .describe("Local file upload specification with path and optional metadata");

export const attachmentUpdate = z
  .strictObject({
    id: snowflake.describe("ID of the existing message attachment to retain or modify"),
    description: z
      .string()
      .optional()
      .describe(
        "Updated alt-text description for the attachment (up to 1024 characters); omit to leave unchanged",
      ),
    is_spoiler: z
      .boolean()
      .optional()
      .describe(
        "Whether to mark or unmark the existing attachment as a spoiler; defaults to unchanged",
      ),
  })
  .describe(
    "Attachment update descriptor for keeping, redescribing, or marking attachments as spoilers",
  );

// Sent as X-Audit-Log-Reason, never in the body.
export const reason = z
  .string()
  .max(512)
  .optional()
  .describe("Audit log reason sent in the X-Audit-Log-Reason header (up to 512 characters)");

export const permissionBits = z
  .string()
  .regex(/^\d+$/, "Expected a permission bitfield")
  .describe("Discord permission bitfield encoded as a decimal numeric string");

export const rateLimitPerUser = z
  .number()
  .int()
  .min(0)
  .max(21600)
  .describe(
    "Slowmode delay in seconds for channel members between messages (0 to 21600 seconds, 6 hours)",
  );

export const autoArchiveDuration = z
  .union([z.literal(60), z.literal(1440), z.literal(4320), z.literal(10080)])
  .describe(
    "Duration in minutes of inactivity before thread automatically archives: 60 (1 hour), 1440 (1 day), 4320 (3 days), or 10080 (7 days)",
  );

export const threadTagSetting = z
  .enum(["match_all", "match_some"])
  .describe(
    "Tag match strategy for thread search queries: 'match_all' requires every tag, 'match_some' matches any tag",
  );

export interface SearchNotReady {
  message?: string;
  code?: number;
  retry_after?: number;
}

// Discord answers 202 with this body, and without total_results, while it builds the search index.
export function isSearchNotReady(res: unknown): res is SearchNotReady {
  return typeof res === "object" && res !== null && !("total_results" in res);
}
export function throwSearchNotReady(body: SearchNotReady): never {
  const retryAfter = body.retry_after ?? 5;
  throw new PToolError(body.message ?? "Search index is not ready", {
    category: "rate_limited",
    retryable: true,
    retryAfter,
    discordCode: body.code,
    remediation: `The search index is still being built; retry after ${retryAfter} seconds`,
  });
}
// Search pages by offset; advance by the results returned so no page is skipped.
export function searchNextOffset(
  offset: number | undefined,
  returned: number,
  page: { has_more?: boolean; total_results?: number },
): number | null {
  const current = offset ?? 0;
  // A page with no results cannot advance the cursor, or paging would loop.
  if (!returned) return null;
  const hasMore = page.has_more ?? (page.total_results ?? 0) > current + returned;
  return hasMore ? current + returned : null;
}

export const sanitizeWebhook = <T extends object>(raw: T): Omit<T, "token" | "url"> => {
  const { token: _token, url: _url, ...rest } = raw as Record<string, unknown>;
  return rest as Omit<T, "token" | "url">;
};
