import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { harness, MESSAGE } from "../../support/harness.js";

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("lists messages with the query parameters and paging cursors", async () => {
  const older = { ...MESSAGE, id: "1" };
  const { client, request } = await harness({ respond: () => [MESSAGE, older] });
  const result = await client.callTool({
    name: "discord_list_messages",
    arguments: { channel_id: "1", limit: 3, before: "4" },
  });
  expect(request().url).toBe("https://discord.com/api/v10/channels/1/messages?limit=3&before=4");
  expect(result.structuredContent).toEqual({
    messages: [MESSAGE, older],
    next_before: "1",
    next_after: "2",
  });
});
