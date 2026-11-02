import type { RESTOptions } from "@discordjs/rest";
import { expect, it, vi } from "vitest";
import { PDiscordRestAdapter } from "../../src/adapters/discord-rest/discord-rest.js";
import { json } from "../support/harness.js";

it("drops undefined query values (n1)", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json([]));
  const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
  await adapter.request(
    { method: "GET", route: "/channels/1/messages", query: { limit: 3, before: undefined } },
    new AbortController().signal,
  );
  expect(makeRequest.mock.calls[0]?.[0]).toBe(
    "https://discord.com/api/v10/channels/1/messages?limit=3",
  );
});
