import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { harness, json } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const get = { channel_id: "1", message_id: "2" };

it("maps a 403 to permission with the tool's required permissions", async () => {
  const { pipeline } = await harness({
    makeRequest: async () => json({ message: "Missing Permissions", code: 50013 }, { status: 403 }),
  });
  expect(await pipeline.call("discord_get_message", get)).toMatchObject({
    ok: false,
    error: {
      category: "permission",
      retryable: false,
      status: 403,
      discord_code: 50013,
      message: "Discord rejected the request (HTTP 403): Missing Permissions",
      remediation: "Check the bot permissions; this tool needs ViewChannel, ReadMessageHistory",
    },
  });
});

it.each([
  [401, "permission", "Check DISCORD_TOKEN"],
  [404, "not_found", "Check the IDs in the request"],
  [409, "conflict", "Check the current state of the resource"],
  [413, "validation", "Send smaller files; Discord rejected the upload size"],
  [418, "discord", "Check the request"],
])("maps HTTP %i to %s", async (status, category, remediation) => {
  const { pipeline } = await harness({
    makeRequest: async () => json({ message: "x", code: 0 }, { status }),
  });
  expect(await pipeline.call("discord_get_message", get)).toMatchObject({
    error: { category, remediation, retryable: false, status },
  });
});

it("returns a long rate limit with retry_after instead of waiting", async () => {
  const { pipeline } = await harness({
    rateLimitWaitMs: 1000,
    makeRequest: async () =>
      json(
        { message: "You are being rate limited.", retry_after: 30, global: false },
        { status: 429, headers: { "retry-after": "30", "x-ratelimit-scope": "user" } },
      ),
  });
  expect(await pipeline.call("discord_get_message", get)).toMatchObject({
    ok: false,
    error: { category: "rate_limited", retryable: true, retry_after: 31 },
  });
});

it("reports a cancelled read as cancelled", async () => {
  const controller = new AbortController();
  const { pipeline } = await harness({
    makeRequest: async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    },
  });
  expect(
    await pipeline.call("discord_get_message", get, { signal: controller.signal }),
  ).toMatchObject({
    error: { category: "cancelled", retryable: false },
  });
});
