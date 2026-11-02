import { DiscordAPIError, HTTPError, REST, type RESTOptions } from "@discordjs/rest";
import { expect, it, vi } from "vitest";
import { PDiscordRestAdapter } from "../../../src/adapters/discord-rest/discord-rest.js";
import { PAttachmentService } from "../../../src/adapters/files/attachment-service.js";
import { PToolPipeline } from "../../../src/core/pipeline.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";

const registry = await PToolRegistry.load();
function setup(rest: PDiscordRestAdapter, files = new PAttachmentService([], "")) {
  return new PToolPipeline(
    registry,
    new PPolicyEngine([], ["messages"], false),
    { rest, files },
    async () => undefined,
  );
}

it("does not replay a failed send and returns its nonce", async () => {
  const makeRequest = vi.fn<RESTOptions["makeRequest"]>(async () => {
    throw new HTTPError(502, "bad gateway", "POST", "https://secret", {});
  });
  const rest = new PDiscordRestAdapter("test", new REST({ retries: 0, makeRequest }));
  const result = await setup(rest).call("discord_send_message", {
    channel_id: "1",
    content: "hello",
  });
  expect(makeRequest).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({
    ok: false,
    error: {
      category: "uncertain",
      retryable: false,
      resource_ids: { channel_id: "1", nonce: expect.stringMatching(/^[a-f0-9]{24}$/) },
    },
  });
  const requestBody = JSON.parse(String(makeRequest.mock.calls[0]?.[1]?.body));
  if (result.ok) throw new Error("Expected uncertain result");
  expect(requestBody.nonce).toBe(result.error.resource_ids.nonce);
  expect(requestBody.enforce_nonce).toBe(true);
});

it("maps Discord permission and server failures through the pipeline", async () => {
  const rest = new PDiscordRestAdapter("test");
  const pipeline = setup(rest);
  vi.spyOn(rest, "getMessage")
    .mockRejectedValueOnce(
      new DiscordAPIError(
        { message: "Missing Permissions", code: 50013 },
        50013,
        403,
        "GET",
        "https://secret",
        {},
      ),
    )
    .mockRejectedValueOnce(new HTTPError(502, "bad gateway", "GET", "https://secret", {}));
  expect(
    await pipeline.call("discord_get_message", { channel_id: "1", message_id: "2" }),
  ).toMatchObject({
    ok: false,
    error: { category: "permission", retryable: false, status: 403, discord_code: 50013 },
  });
  expect(
    await pipeline.call("discord_get_message", { channel_id: "1", message_id: "2" }),
  ).toMatchObject({ ok: false, error: { category: "discord", retryable: true, status: 502 } });
});

it("returns rate-limit and file policy categories", async () => {
  const rest = new PDiscordRestAdapter("test");
  vi.spyOn(rest, "getMessage").mockRejectedValueOnce(
    new HTTPError(429, "rate limited", "GET", "https://secret", {}),
  );
  const pipeline = setup(rest);
  expect(
    await pipeline.call("discord_get_message", { channel_id: "1", message_id: "2" }),
  ).toMatchObject({ ok: false, error: { category: "rate_limited", retryable: true } });
  expect(
    await pipeline.call("discord_send_message", {
      channel_id: "1",
      files: [{ path: "/etc/hosts" }],
    }),
  ).toMatchObject({ ok: false, error: { category: "policy", retryable: false } });
});

it("returns not_found for an unknown attachment", async () => {
  const rest = new PDiscordRestAdapter("test");
  vi.spyOn(rest, "getMessage").mockResolvedValue({ attachments: [] } as unknown as Awaited<
    ReturnType<typeof rest.getMessage>
  >);
  const result = await setup(rest).call("discord_download_attachment", {
    channel_id: "1",
    message_id: "2",
    attachment_id: "3",
  });
  expect(result).toMatchObject({
    ok: false,
    error: { category: "not_found", retryable: false, message: "Attachment not found" },
  });
});
