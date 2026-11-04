import { type RESTGetAPICurrentUserConnectionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { connection } from "./schemas.js";

export const listMyConnections = defineTool({
  name: "discord_list_my_connections",
  description:
    "List external service accounts connected to the authenticated bot or OAuth user account, such as Battle.net, GitHub, Twitch, YouTube, or Steam. Use this to view linked platforms and their visibility settings; to inspect bot guild memberships use discord_list_my_guilds. Returns an array of connection objects with name, type, and verification status.",
  operationIds: ["list_my_connections"],
  toolset: "core",
  scope: "none",
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({}),
  output: z.object({
    connections: z.array(connection),
  }),
  execute: async (_params, { discord }) => ({
    connections: await discord<RESTGetAPICurrentUserConnectionsResult>({
      method: "GET",
      route: Routes.userConnections(),
    }),
  }),
});
