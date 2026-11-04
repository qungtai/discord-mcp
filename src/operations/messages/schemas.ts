import { z } from "zod/v4";
import { allowedMentions, message, resource, snowflake } from "../schemas.js";

export const messageIds = {
  channel_id: snowflake.describe("ID of the channel or thread that holds the message"),
  message_id: snowflake.describe("ID of the message"),
};

export const messageBody = {
  content: z.string().optional().describe("Message text, up to 2000 characters"),
  embeds: z
    .array(z.record(z.string(), z.unknown()).describe("One Discord embed object"))
    .optional()
    .describe(
      "Up to 10 rich embed objects; text across all embeds is limited to 6000 characters. Each object takes Discord embed fields such as title, description, url, color (integer), fields, author, footer, image and thumbnail",
    ),
  allowed_mentions: allowedMentions.describe(
    "Allowed mentions object controlling which role, user, or @everyone pings produce notifications; defaults to no pings",
  ),
};

export const messageResult = z.object({ message });

const pollEmoji = z
  .strictObject({
    id: snowflake.optional().describe("ID of a custom guild emoji"),
    name: z.string().min(1).optional().describe("Unicode emoji character or custom emoji name"),
  })
  .refine((media) => media.id !== undefined || media.name !== undefined, {
    message: "Provide id or name",
  });

// Discord create-message poll body.
export const poll = z
  .strictObject({
    question: z
      .strictObject({
        text: z.string().min(1).max(300).describe("Poll question title (1-300 characters)"),
      })
      .describe("Poll question prompt"),
    answers: z
      .array(
        z
          .strictObject({
            poll_media: z
              .strictObject({
                text: z.string().min(1).max(55).describe("Answer text (1-55 characters)"),
                emoji: pollEmoji.optional().describe("Optional emoji display for the answer"),
              })
              .describe("Answer choice display content (text and optional emoji)"),
          })
          .describe("One answer choice"),
      )
      .min(1)
      .max(10)
      .describe("Between 1 and 10 possible answers for voters to choose from"),
    duration: z
      .number()
      .int()
      .min(1)
      .max(768)
      .optional()
      .describe("Poll duration in hours up to 32 days (768 hours; default is 24 hours)"),
    allow_multiselect: z
      .boolean()
      .optional()
      .describe("Whether voters can select more than one answer (default false)"),
    layout_type: z
      .literal(1)
      .optional()
      .describe("Poll layout type (1 for standard default poll layout)"),
  })
  .describe("Poll to create with the message");

export const pinnedMessage = resource(
  z.looseObject({
    pinned_at: z.string(),
    message,
  }),
);
