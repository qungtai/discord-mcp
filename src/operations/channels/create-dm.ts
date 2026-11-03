import { type RESTPostAPICurrentUserCreateDMChannelResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { channelResult } from "./schemas.js";

export const createDm = defineTool({
  name: "discord_create_dm",
  description: "Open a direct message channel with a user",
  operationIds: ["create_dm"],
  toolset: "channels",
  scope: { user: "recipient_id" },
  permissions: [],
  effect: "write",
  idempotent: false,
  input: z.object({
    recipient_id: snowflake,
  }),
  output: channelResult,
  execute: async ({ recipient_id }, { discord }) => ({
    channel: await discord<RESTPostAPICurrentUserCreateDMChannelResult>({
      method: "POST",
      route: Routes.userChannels(),
      body: { recipient_id },
    }),
  }),
});
