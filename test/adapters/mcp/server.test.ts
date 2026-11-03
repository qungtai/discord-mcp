import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createServer } from "../../../src/adapters/mcp/server.js";
import { PToolPipeline } from "../../../src/core/pipeline.js";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { createScopeResolver } from "../../../src/core/scope.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";

describe("createServer", () => {
  it("reports serverInfo.version matching package.json version", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const pipeline = new PToolPipeline(new PToolRegistry(), new PPolicyEngine([], [], false), {
      credentials: { bot: {} as never },
      files: {} as never,
      resolveScope: createScopeResolver(),
    });
    const server = createServer(pipeline);
    expect(
      (server as unknown as { _serverInfo: { name: string; version: string } })._serverInfo.version,
    ).toBe(pkg.version);
  });
});
