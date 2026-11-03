import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("server.json registry metadata", () => {
  it("matches package.json version and mcpName", () => {
    const pkgPath = join(process.cwd(), "package.json");
    const serverPath = join(process.cwd(), "server.json");

    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name: string;
      version: string;
      mcpName: string;
    };
    const server = JSON.parse(readFileSync(serverPath, "utf8")) as {
      name: string;
      version: string;
      packages?: Array<{ identifier?: string; version?: string }>;
    };

    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(server.packages?.[0]?.version).toBe(pkg.version);
    expect(server.packages?.[0]?.identifier).toBe(pkg.name);
  });
});
