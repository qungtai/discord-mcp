import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { beforeAll, expect, it } from "vitest";

beforeAll(() => {
  execFileSync("node_modules/.bin/tsc", ["-p", "tsconfig.build.json"]);
}, 60_000);

it("writes only JSON-RPC messages to stdout", async () => {
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: { PATH: process.env.PATH, DISCORD_TOKEN: "dummy-token" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines: string[] = [];
  const listed = new Promise<void>((resolve) => {
    createInterface({ input: child.stdout }).on("line", (line) => {
      lines.push(line);
      if (line.includes('"id":3')) resolve();
    });
  });
  const send = (message: object) =>
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  send({
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "t", version: "1" },
    },
  });
  send({ method: "notifications/initialized" });
  send({ id: 2, method: "tools/list" });
  send({
    id: 3,
    method: "tools/call",
    params: { name: "discord_get_message", arguments: { channel_id: "x", message_id: "1" } },
  });
  await listed;
  child.kill();
  const messages = lines.map((line) => JSON.parse(line));
  expect(messages.every((m) => m.jsonrpc === "2.0")).toBe(true);
  expect(messages[0].result.protocolVersion).toBe("2025-11-25");
  expect(messages.find((m) => m.id === 2).result.tools).toHaveLength(5);
  expect(JSON.parse(messages.at(-1).result.content[0].text).error).toMatchObject({
    category: "validation",
    tool: "discord_get_message",
  });
});
