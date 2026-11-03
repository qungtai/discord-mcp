import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { beforeAll, expect, it } from "vitest";

beforeAll(() => {
  rmSync("dist", { recursive: true, force: true });
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
  const listToolsResult = messages.find((m) => m.id === 2).result.tools;
  expect(listToolsResult.map((t: { name: string }) => t.name)).toContain("discord_get_message");
  expect(JSON.parse(messages.at(-1).result.content[0].text).error).toMatchObject({
    category: "validation",
    tool: "discord_get_message",
  });
});

it("refuses uploading a file that contains the bot token with a policy error", async () => {
  const dummyToken = "dummy-token";
  const tempDir = mkdtempSync(join(tmpdir(), "stdio-token-test-"));
  const tempFile = join(tempDir, "token-leak.txt");
  writeFileSync(tempFile, `some preamble ${dummyToken} postamble`);

  const child = spawn(process.execPath, ["dist/index.js"], {
    env: { PATH: process.env.PATH, DISCORD_TOKEN: dummyToken },
    stdio: ["pipe", "pipe", "pipe"],
  });

  try {
    const lines: string[] = [];
    const listed = new Promise<void>((resolve) => {
      createInterface({ input: child.stdout }).on("line", (line) => {
        lines.push(line);
        if (line.includes('"id":2')) resolve();
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
    send({
      id: 2,
      method: "tools/call",
      params: {
        name: "discord_send_message",
        arguments: {
          channel_id: "123456789012345678",
          content: "hello",
          files: [{ path: tempFile }],
        },
      },
    });
    await listed;

    const messages = lines.map((line) => JSON.parse(line));
    const callResult = messages.find((m) => m.id === 2);
    expect(callResult.result.isError).toBe(true);
    const errorBody = JSON.parse(callResult.result.content[0].text).error;
    expect(errorBody).toMatchObject({
      category: "policy",
      message: "File contains the bot token",
      tool: "discord_send_message",
    });
  } finally {
    child.kill();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it("exits with status 1 and writes single stderr line without stack trace when DISCORD_TOKEN is missing", async () => {
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: { PATH: process.env.PATH },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderrChunks: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  expect(exitCode).toBe(1);
  const stderrOutput = stderrChunks.join("");
  expect(stderrOutput).toBe("DISCORD_TOKEN is required\n");
});

it("fails startup when DISCORD_MCP_TOOLSETS includes a toolset without tools", async () => {
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: {
      PATH: process.env.PATH,
      DISCORD_TOKEN: "dummy-token",
      DISCORD_MCP_TOOLSETS: "core,voice",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderrChunks: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  expect(exitCode).not.toBe(0);
  expect(stderrChunks.join("")).toContain("Toolset voice has no tools yet");
});

it("fails startup when DISCORD_MCP_MAX_DOWNLOAD_BYTES is invalid", async () => {
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: {
      PATH: process.env.PATH,
      DISCORD_TOKEN: "dummy-token",
      DISCORD_MCP_MAX_DOWNLOAD_BYTES: "0",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderrChunks: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  expect(exitCode).not.toBe(0);
  expect(stderrChunks.join("")).toContain(
    "DISCORD_MCP_MAX_DOWNLOAD_BYTES must be a positive integer",
  );
});
