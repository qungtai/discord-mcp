import type { ResponseLike } from "@discordjs/rest";
import { vi } from "vitest";
import { PPolicyEngine } from "../../../src/core/policy.js";
import { PToolRegistry } from "../../../src/core/tool-registry.js";
import { harness } from "../../support/harness.js";

export const SAMPLE_THREAD = {
  id: "101",
  type: 11,
  guild_id: "200",
  name: "sample-thread",
  parent_id: "1",
  owner_id: "3001",
  message_count: 5,
  member_count: 3,
  total_message_sent: 7,
  applied_tags: ["5001"],
  thread_metadata: {
    archived: false,
    archive_timestamp: "2026-11-03T00:00:00.000Z",
    auto_archive_duration: 60,
    locked: false,
    create_timestamp: "2026-11-02T00:00:00.000Z",
    invitable: true,
  },
};

export const empty204 = () => new Response(null, { status: 204 }) as unknown as ResponseLike;

export function threadHarness(options: Parameters<typeof harness>[0] = {}) {
  return harness({
    ...options,
    policy: options.policy ?? new PPolicyEngine([], ["threads"], false),
  });
}

export async function bypassApproval(toolName: string) {
  const base = (await PToolRegistry.load()).get(toolName);
  if (!base) throw new Error(`Missing tool: ${toolName}`);
  const registry = new PToolRegistry();
  registry.register({ ...base, approval: false });
  return registry;
}

export function setupTestLifecycle() {
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
}
