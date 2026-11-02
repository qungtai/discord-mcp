import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { harness, json } from "../../support/harness.js";

const get = { channel_id: "1", message_id: "2" };
beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

it("does not replay a failed send and returns its nonce for a deduplicated retry", async () => {
  const { pipeline, makeRequest } = await harness({
    makeRequest: async () => json({}, { status: 502 }),
  });
  const result = await pipeline.call("discord_send_message", { channel_id: "1", content: "hello" });
  expect(makeRequest).toHaveBeenCalledTimes(1);
  if (result.ok) throw new Error("Expected uncertain result");
  expect(result.error).toMatchObject({
    category: "uncertain",
    retryable: false,
    remediation: "Check the result before retrying, or retry with the same nonce",
    resource_ids: { channel_id: "1", nonce: expect.stringMatching(/^[a-f0-9]{24}$/) },
  });
  const body = JSON.parse(String(makeRequest.mock.calls[0]?.[1]?.body));
  expect(body.nonce).toBe(result.error.resource_ids.nonce);
});

it("logs the redacted cause of a Discord failure", async () => {
  const { pipeline } = await harness({ makeRequest: async () => json({}, { status: 502 }) });
  await pipeline.call("discord_send_message", { channel_id: "1", content: "hello" });
  const written = vi
    .mocked(process.stderr.write)
    .mock.calls.map(([c]) => String(c))
    .join("");
  expect(written).toMatch(
    /uncertain: The write may have been applied \(cause: PToolError: Discord request failed \(HTTP 502\) <- HTTPError/,
  );
});

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

it("returns Discord's field errors for a 400", async () => {
  const { pipeline } = await harness({
    makeRequest: async () =>
      json(
        {
          message: "Invalid Form Body",
          code: 50035,
          errors: {
            content: {
              _errors: [
                { code: "BASE_TYPE_MAX_LENGTH", message: "Must be 2000 or fewer in length." },
              ],
            },
          },
        },
        { status: 400 },
      ),
  });
  expect(
    await pipeline.call("discord_send_message", { channel_id: "1", content: "x" }),
  ).toMatchObject({
    error: {
      category: "validation",
      retryable: false,
      discord_code: 50035,
      message:
        "Discord rejected the request (HTTP 400): Invalid Form Body\ncontent[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length.",
    },
  });
});

it.each([
  [401, "permission", "Check DISCORD_TOKEN"],
  [404, "not_found", "Check the IDs in the request"],
  [409, "conflict", "Check the current state of the resource"],
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

it("blocks mutating tools in read-only mode and uploads outside the roots", async () => {
  const readOnly = await harness({ policy: new PPolicyEngine([], ["messages"], true) });
  expect(
    await readOnly.pipeline.call("discord_send_message", { channel_id: "1", content: "x" }),
  ).toMatchObject({ error: { category: "policy", message: "Read-only mode" } });
  const { pipeline, makeRequest } = await harness();
  expect(
    await pipeline.call("discord_send_message", {
      channel_id: "1",
      files: [{ path: "/etc/hosts" }],
    }),
  ).toMatchObject({ ok: false, error: { category: "policy", retryable: false } });
  expect(makeRequest).not.toHaveBeenCalled();
});

it("returns not_found for an unknown attachment", async () => {
  const { pipeline } = await harness({
    respond: () => ({ id: "2", channel_id: "1", attachments: [] }),
  });
  expect(
    await pipeline.call("discord_download_attachment", { ...get, attachment_id: "3" }),
  ).toMatchObject({
    ok: false,
    error: { category: "not_found", retryable: false, message: "Attachment not found" },
  });
});
