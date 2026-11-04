import { type RESTGetAPIChannelMessagesPinsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { pinnedMessage } from "./schemas.js";

export const listPins = defineTool({
  name: "discord_list_pins",
  description:
    "List pinned messages in a channel or thread with their pin timestamps, newest pin first. Each channel supports up to 50 pins. To pin a new message use discord_create_pin, and to unpin use discord_delete_pin. Page older pins with before=next_before.",
  operationIds: ["list_pins", "deprecated_list_pins"],
  toolset: "messages",
  scope: { channel: "channel_id" },
  permissions: ["ViewChannel", "ReadMessageHistory"],
  effect: "read",
  idempotent: true,
  output: z.object({
    items: z.array(pinnedMessage),
    has_more: z.boolean(),
    next_before: z.string().nullable(),
  }),
  input: z.object({
    channel_id: snowflake.describe("ID of the channel or thread to list pinned messages from"),
    before: z.iso
      .datetime()
      .optional()
      .describe(
        "ISO 8601 timestamp cursor to fetch pins created before this time (use next_before)",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max number of pinned messages to return (1-50; default is 50)"),
  }),
  execute: async ({ channel_id, ...query }, { discord }) => {
    const res = await discord<RESTGetAPIChannelMessagesPinsResult>({
      method: "GET",
      route: Routes.channelMessagesPins(channel_id),
      query,
    });
    return {
      items: res.items,
      has_more: res.has_more,
      next_before: res.has_more ? (res.items.at(-1)?.pinned_at ?? null) : null,
    };
  },
});
