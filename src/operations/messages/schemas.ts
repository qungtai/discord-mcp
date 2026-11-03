import { z } from "zod/v4";
import { allowedMentions, message, resource, snowflake } from "../schemas.js";

export const messageIds = { channel_id: snowflake, message_id: snowflake };
export const messageBody = {
  content: z.string().optional(),
  embeds: z.array(z.record(z.string(), z.unknown())).optional(),
  allowed_mentions: allowedMentions,
};
export const messageResult = z.object({ message });

const pollEmoji = z
  .strictObject({
    id: snowflake.optional(),
    name: z.string().min(1).optional(),
  })
  .refine((media) => media.id !== undefined || media.name !== undefined, {
    message: "Provide id or name",
  });

// Discord create-message poll body.
export const poll = z.strictObject({
  question: z.strictObject({ text: z.string().min(1).max(300) }),
  answers: z
    .array(
      z.strictObject({
        poll_media: z.strictObject({
          text: z.string().min(1).max(55),
          emoji: pollEmoji.optional(),
        }),
      }),
    )
    .min(1)
    .max(10),
  duration: z.number().int().min(1).max(768).optional().describe("Poll duration in hours"),
  allow_multiselect: z.boolean().optional(),
  layout_type: z.literal(1).optional().describe("1 for the default poll layout"),
});

export const pinnedMessage = resource(
  z.looseObject({
    pinned_at: z.string(),
    message,
  }),
);
