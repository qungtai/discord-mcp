import { expect, it, vi } from "vitest";
import { PToolPipeline } from "../../../src/core/pipeline.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { registerMessageTools } from "../../../src/operations/messages/tools.js";

it("sends, reads, edits and downloads using fresh attachment metadata", async () => {
  const existing = {
    attachments: [
      {
        id: "11",
        filename: "one.png",
        description: "old",
        url: "https://cdn.discordapp.com/one",
        proxy_url: "https://evil",
      },
      { id: "12", filename: "SPOILER_two.png", url: "https://cdn.discordapp.com/two" },
      { id: "13", filename: "three.png", url: "https://cdn.discordapp.com/three" },
    ],
  };
  const rest = {
    getChannel: vi.fn(),
    getMessage: vi.fn(async () => existing),
    listMessages: vi.fn(async () => []),
    sendMessage: vi.fn(async () => existing),
    editMessage: vi.fn(async () => existing),
    deleteMessage: vi.fn(async () => {}),
  };
  const attachments = {
    upload: vi.fn(async () => ({ name: "new.txt", data: Buffer.from("x") })),
    download: vi.fn(async () => ({ path: "/tmp/test", size: 1, sha256: "hash" })),
  };
  const registry = new PToolRegistry();
  registerMessageTools(registry, rest, attachments);
  const pipeline = new PToolPipeline(
    registry,
    new PPolicyEngine([], ["messages"], false),
    async () => undefined,
  );
  const call = (name: string, input: object) => pipeline.call(`discord_${name}`, input);
  expect(
    (
      await call("send_message", {
        channel_id: "1",
        content: "hello",
        files: [{ path: "/a", spoiler: true, description: "alt" }],
      })
    ).ok,
  ).toBe(true);
  expect(rest.sendMessage).toHaveBeenCalledWith(
    "1",
    expect.objectContaining({
      allowed_mentions: { parse: [] },
      attachments: [{ id: "0", filename: "SPOILER_new.txt", description: "alt" }],
    }),
    [expect.objectContaining({ name: "SPOILER_new.txt" })],
  );
  expect(
    (
      await call("edit_message", {
        channel_id: "1",
        message_id: "2",
        update_attachments: [
          { id: "11", description: "new", is_spoiler: true },
          { id: "12", is_spoiler: false },
        ],
        add_files: [{ path: "/a", description: "added" }],
      })
    ).ok,
  ).toBe(true);
  expect(rest.editMessage).toHaveBeenCalledWith(
    "1",
    "2",
    expect.objectContaining({
      attachments: [
        { id: "11", filename: "SPOILER_one.png", description: "new" },
        { id: "12", filename: "two.png", description: undefined },
        { id: "13", filename: "three.png", description: undefined },
        { id: "0", filename: "new.txt", description: "added" },
      ],
    }),
    expect.any(Array),
  );
  await call("edit_message", { channel_id: "1", message_id: "2", content: "change" });
  expect(rest.editMessage.mock.lastCall?.[2]).not.toHaveProperty("attachments");
  expect(
    (
      await call("edit_message", {
        channel_id: "1",
        message_id: "2",
        remove_attachment_ids: ["99"],
      })
    ).ok,
  ).toBe(false);
  expect((await call("get_message", { channel_id: "1", message_id: "2" })).ok).toBe(true);
  expect((await call("list_messages", { channel_id: "1", limit: 3, before: "4" })).ok).toBe(true);
  expect(rest.listMessages.mock.lastCall?.[1].toString()).toBe("limit=3&before=4");
  expect(
    (await call("download_attachment", { channel_id: "1", message_id: "2", attachment_id: "11" }))
      .ok,
  ).toBe(true);
  expect(attachments.download).toHaveBeenCalledWith("https://cdn.discordapp.com/one", "one.png");
  expect(
    (await call("download_attachment", { channel_id: "1", message_id: "2", attachment_id: "99" }))
      .ok,
  ).toBe(false);
  expect((await call("delete_message", { channel_id: "1", message_id: "2" })).ok).toBe(false);
});
