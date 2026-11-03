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

it.each(["..", ".", "%2e%2e", "%2e", ".%2E", "%2E."])(
  "refuses the dot segment %s",
  async (segment) => {
    const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json({}));
    const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
    await expect(
      adapter.request(
        { method: "PATCH", route: `/guilds/1/${segment}` },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      category: "validation",
      retryable: false,
      message: "Invalid route: a path segment is a dot segment",
    });
    expect(makeRequest).not.toHaveBeenCalled();
  },
);

it("allows a segment that only looks like a dot segment", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json({}));
  const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
  await adapter.request(
    { method: "PATCH", route: "/guilds/1/..abc" },
    new AbortController().signal,
  );
  expect(makeRequest.mock.calls[0]?.[0]).toBe("https://discord.com/api/v10/guilds/1/..abc");
});

it("includes the Authorization header by default", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json({}));
  const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
  await adapter.request({ method: "GET", route: "/guilds/1" }, new AbortController().signal);
  const options = makeRequest.mock.calls[0]?.[1];
  expect(options?.headers).toHaveProperty("Authorization", "Bot test-token");
});

it("omits the Authorization header when auth is false", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => json({}));
  const adapter = new PDiscordRestAdapter("test-token", { rest: { makeRequest } });
  await adapter.request(
    { method: "POST", route: "/webhooks/1/tok", auth: false },
    new AbortController().signal,
  );
  const options = makeRequest.mock.calls[0]?.[1];
  expect(options?.headers).not.toHaveProperty("Authorization");
});

it("fails fast on 429 without Retry-After (code 30040)", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () =>
    json(
      { message: "Max number of prune requests has been reached", code: 30040 },
      { status: 429 },
    ),
  );
  const adapter = new PDiscordRestAdapter("test-token", {
    rest: { makeRequest, offset: 0 },
  });
  await expect(
    adapter.request({ method: "POST", route: "/guilds/1/prune" }, new AbortController().signal),
  ).rejects.toEqual(
    expect.objectContaining({
      name: "PToolError",
      category: "rate_limited",
      retryable: true,
      message: "Discord rate limit exceeded",
      remediation: "Discord did not say when to retry; wait a few minutes before retrying",
      retryAfter: undefined,
    }),
  );
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("fails fast on 429 with long Retry-After", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () =>
    json(
      { message: "You are being rate limited.", retry_after: 650, global: false },
      { status: 429, headers: { "retry-after": "650" } },
    ),
  );
  const adapter = new PDiscordRestAdapter("test-token", {
    rest: { makeRequest, offset: 0 },
  });
  await expect(
    adapter.request({ method: "GET", route: "/guilds/1" }, new AbortController().signal),
  ).rejects.toEqual(
    expect.objectContaining({
      name: "PToolError",
      category: "rate_limited",
      retryable: true,
      message: "Discord rate limit exceeded",
      remediation: "Retry after retry_after seconds",
      retryAfter: 650,
    }),
  );
  expect(makeRequest).toHaveBeenCalledTimes(1);
});

it("retries a 429 with short Retry-After once and then succeeds", async () => {
  let calls = 0;
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => {
    calls++;
    if (calls === 1) {
      return json(
        { message: "You are being rate limited.", retry_after: 1, global: false },
        { status: 429, headers: { "retry-after": "1" } },
      );
    }
    return json({ id: "1", name: "test-guild" });
  });
  const adapter = new PDiscordRestAdapter("test-token", {
    rest: { makeRequest, offset: 0 },
  });
  const result = await adapter.request(
    { method: "GET", route: "/guilds/1" },
    new AbortController().signal,
  );
  expect(result).toEqual({ id: "1", name: "test-guild" });
  expect(makeRequest).toHaveBeenCalledTimes(2);
});
