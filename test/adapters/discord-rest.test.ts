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

it("repeats keys for array query values and skips empty arrays", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json([]));
  const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
  await adapter.request(
    {
      method: "GET",
      route: "/guilds/1/messages/search",
      query: { author_id: ["10", "20"], channel_id: [] },
    },
    new AbortController().signal,
  );
  expect(makeRequest.mock.calls[0]?.[0]).toBe(
    "https://discord.com/api/v10/guilds/1/messages/search?author_id=10&author_id=20",
  );
});

it("refuses a route with a dot segment", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json({}));
  const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
  await expect(
    adapter.request({ method: "PATCH", route: "/guilds/1/%2e%2e" }, new AbortController().signal),
  ).rejects.toMatchObject({
    category: "validation",
    retryable: false,
    message: "Invalid route: a path segment is a dot segment",
  });
  expect(makeRequest).not.toHaveBeenCalled();
});
