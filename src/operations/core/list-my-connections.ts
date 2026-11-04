import { type RESTGetAPICurrentUserConnectionsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { connection } from "./schemas.js";

export const listMyConnections = defineTool({
  name: "discord_list_my_connections",
  description:
    "List the external accounts (for example GitHub, Twitch, YouTube, Steam) linked to the account behind the credential, with each connection's name, type, verified flag and visibility. Discord requires an OAuth2 token with the connections scope for this endpoint, so a plain bot token can be refused; to list the guilds the bot is in use discord_list_my_guilds. Returns the connections array.",
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
