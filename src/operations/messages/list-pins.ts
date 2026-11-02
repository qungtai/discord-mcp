import { type RESTGetAPIChannelMessagesPinsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { pinnedMessage } from "./schemas.js";

export const listPins = defineTool({
  name: "discord_list_pins",
  description: "List pinned messages in a channel",
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
    channel_id: snowflake,
    before: z.iso.datetime().optional(),
    limit: z.number().int().min(1).max(50).optional(),
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
