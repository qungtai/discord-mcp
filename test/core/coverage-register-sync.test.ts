import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error script module tested directly
import { checkRegisterDrift, syncRegister } from "../../scripts/coverage/sync.mjs";

describe("coverage register sync and check", () => {
  const fixtureRegister = {
    repo: "discord/discord-api-spec",
    commit: "test-commit",
    total_operations: 3,
    operations: [
      {
        capability_id: "get_channels_messages",
        operation_id: "list_messages",
        method: "GET",
        path: "/channels/{channel_id}/messages",
        group: "channels",
        source_commit: "test-commit",
        doc_link: "https://discord.com/developers/docs/resources/channel",
        auth: [{ type: "bot" }],
        permissions: null,
        mcp_tool: null,
        implementation: "unmapped",
        availability: "unknown",
        verification: "not_tested",
        evidence: [],
        notes: null,
      },
      {
        capability_id: "post_channels_messages",
        operation_id: "create_message",
        method: "POST",
        path: "/channels/{channel_id}/messages",
        group: "channels",
        source_commit: "test-commit",
        doc_link: "https://discord.com/developers/docs/resources/channel",
        auth: [{ type: "bot" }],
        permissions: null,
        mcp_tool: null,
        implementation: "unmapped",
        availability: "unknown",
        verification: "not_tested",
        evidence: [],
        notes: null,
      },
      {
        capability_id: "delete_channels_messages",
        operation_id: "delete_message",
        method: "DELETE",
        path: "/channels/{channel_id}/messages/{message_id}",
        group: "channels",
        source_commit: "test-commit",
        doc_link: "https://discord.com/developers/docs/resources/channel",
        auth: [{ type: "bot" }],
        permissions: null,
        mcp_tool: null,
        implementation: "deferred",
        availability: "unknown",
        verification: "not_tested",
        evidence: [],
        notes: null,
      },
    ],
  };

  const fixtureTools = [
    {
      name: "discord_list_messages",
      toolset: "messages",
      operation_ids: ["list_messages"],
      effect: "read",
    },
    {
      name: "discord_send_message",
      toolset: "messages",
      operation_ids: ["create_message"],
      effect: "write",
    },
  ];

  const fixtureEvidence = {
    date: "2026-11-03",
    tools: {
      discord_send_message: "sent message and verified in channel",
    },
  };

  it("syncs tiny fixture register and asserts literal resulting register", () => {
    const synced = syncRegister(fixtureRegister, fixtureTools, fixtureEvidence);

    expect(synced).toEqual({
      repo: "discord/discord-api-spec",
      commit: "test-commit",
      total_operations: 3,
      operations: [
        {
          capability_id: "get_channels_messages",
          operation_id: "list_messages",
          method: "GET",
          path: "/channels/{channel_id}/messages",
          group: "channels",
          source_commit: "test-commit",
          doc_link: "https://discord.com/developers/docs/resources/channel",
          auth: [{ type: "bot" }],
          permissions: null,
          mcp_tool: "discord_list_messages",
          implementation: "implemented",
          availability: "unknown",
          verification: "mocked contract tested",
          evidence: [],
          notes: null,
        },
        {
          capability_id: "post_channels_messages",
          operation_id: "create_message",
          method: "POST",
          path: "/channels/{channel_id}/messages",
          group: "channels",
          source_commit: "test-commit",
          doc_link: "https://discord.com/developers/docs/resources/channel",
          auth: [{ type: "bot" }],
          permissions: null,
          mcp_tool: "discord_send_message",
          implementation: "implemented",
          availability: "unknown",
          verification: "live action verified",
          evidence: [
            {
              date: "2026-11-03",
              tool: "discord_send_message",
              evidence: "sent message and verified in channel",
            },
          ],
          notes: null,
        },
        {
          capability_id: "delete_channels_messages",
          operation_id: "delete_message",
          method: "DELETE",
          path: "/channels/{channel_id}/messages/{message_id}",
          group: "channels",
          source_commit: "test-commit",
          doc_link: "https://discord.com/developers/docs/resources/channel",
          auth: [{ type: "bot" }],
          permissions: null,
          mcp_tool: null,
          implementation: "deferred",
          availability: "unknown",
          verification: "not_tested",
          evidence: [],
          notes: null,
        },
      ],
    });

    const checkResult = checkRegisterDrift(synced, fixtureTools, fixtureEvidence);
    expect(checkResult).toEqual({ ok: true });
  });

  it("fails with literal error message for a stale mapping", () => {
    const staleRegister = {
      ...fixtureRegister,
      operations: [
        {
          ...fixtureRegister.operations[0],
          mcp_tool: null,
          implementation: "unmapped",
        },
        fixtureRegister.operations[1],
        fixtureRegister.operations[2],
      ],
    };

    const checkResult = checkRegisterDrift(staleRegister, fixtureTools, fixtureEvidence);
    expect(checkResult).toEqual({
      ok: false,
      error:
        'operation list_messages mcp_tool mismatch: register has null, expected "discord_list_messages"',
    });
  });

  it("fails with literal error message for an unknown evidence tool", () => {
    const synced = syncRegister(fixtureRegister, fixtureTools, fixtureEvidence);
    const badEvidence = {
      date: "2026-11-03",
      tools: {
        discord_non_existent_tool: "some evidence",
      },
    };

    const checkResult = checkRegisterDrift(synced, fixtureTools, badEvidence);
    expect(checkResult).toEqual({
      ok: false,
      error: "live-evidence.json references unknown tool discord_non_existent_tool",
    });
  });

  it("prefers tool named discord_<operation_id> when multiple tools map to the same operation", () => {
    const multiTools = [
      {
        name: "discord_download_attachment",
        toolset: "messages",
        operation_ids: ["get_message"],
      },
      {
        name: "discord_get_message",
        toolset: "messages",
        operation_ids: ["get_message"],
      },
    ];
    const opRegister = {
      repo: "test",
      commit: "test",
      total_operations: 1,
      operations: [
        {
          capability_id: "get_msg",
          operation_id: "get_message",
          mcp_tool: null,
          implementation: "unmapped",
          verification: "not_tested",
          evidence: [],
        },
      ],
    };
    const synced = syncRegister(opRegister, multiTools, null);
    expect(synced.operations[0].mcp_tool).toBe("discord_get_message");
  });

  it("resets verification to not_tested and evidence to [] when an implemented operation loses its tool", () => {
    const implementedRegister = {
      repo: "test",
      commit: "test",
      total_operations: 1,
      operations: [
        {
          capability_id: "get_msg",
          operation_id: "get_message",
          mcp_tool: "discord_get_message",
          implementation: "implemented",
          verification: "live action verified",
          evidence: [{ date: "2026-11-03", tool: "discord_get_message", evidence: "verified" }],
        },
      ],
    };
    const synced = syncRegister(implementedRegister, [], null);
    expect(synced.operations[0]).toMatchObject({
      mcp_tool: null,
      implementation: "unmapped",
      verification: "not_tested",
      evidence: [],
    });
  });

  it("catches drift when committed register is not updated after adding a tool", () => {
    const committedRegister = {
      repo: "test",
      commit: "test",
      total_operations: 1,
      operations: [
        {
          capability_id: "get_msg",
          operation_id: "get_message",
          mcp_tool: null,
          implementation: "unmapped",
          verification: "not_tested",
          evidence: [],
        },
      ],
    };
    const newTools = [
      {
        name: "discord_get_message",
        toolset: "messages",
        operation_ids: ["get_message"],
      },
    ];
    // Sequence check: with tools present, checking committed un-synced register fails
    const drift = checkRegisterDrift(committedRegister, newTools, null);
    expect(drift.ok).toBe(false);
    expect(drift.error).toContain("mcp_tool mismatch");
  });

  it("runs check.mjs via node in a temp directory and fails with exit 1 and literal message when tools.json is missing or register is stale", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-script-test-"));
    const scriptPath = join(process.cwd(), "scripts/coverage/check.mjs");
    try {
      const coverageDir = join(tempDir, "coverage");
      mkdirSync(coverageDir, { recursive: true });

      const baseline = {
        repo: "test-repo",
        commit: "test-commit",
        files: [],
      };
      writeFileSync(join(coverageDir, "baseline.json"), JSON.stringify(baseline));

      const register = {
        repo: "test-repo",
        commit: "test-commit",
        total_operations: 1,
        operations: [
          {
            capability_id: "get_msg",
            operation_id: "get_message",
            method: "GET",
            path: "/messages",
            implementation: "unmapped",
            availability: "unknown",
            verification: "not_tested",
            mcp_tool: null,
          },
        ],
      };
      writeFileSync(join(coverageDir, "register.json"), JSON.stringify(register));

      // 1. Missing tools.json
      let missingToolsErr: { status?: number; stderr?: string } | undefined;
      try {
        execFileSync(process.execPath, [scriptPath], {
          cwd: tempDir,
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch (err) {
        missingToolsErr = err as { status?: number; stderr?: string };
      }
      expect(missingToolsErr).toBeDefined();
      expect(missingToolsErr?.status).toBe(1);
      expect(missingToolsErr?.stderr).toContain(
        "CHECK FAILED: run pnpm build && pnpm tools:manifest first",
      );

      // 2. Stale register: tools.json has discord_get_message mapped to get_message, but register.json has null
      const tools = [
        {
          name: "discord_get_message",
          toolset: "messages",
          operation_ids: ["get_message"],
          effect: "read",
        },
      ];
      writeFileSync(join(coverageDir, "tools.json"), JSON.stringify(tools));

      let staleRegisterErr: { status?: number; stderr?: string } | undefined;
      try {
        execFileSync(process.execPath, [scriptPath], {
          cwd: tempDir,
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch (err) {
        staleRegisterErr = err as { status?: number; stderr?: string };
      }
      expect(staleRegisterErr).toBeDefined();
      expect(staleRegisterErr?.status).toBe(1);
      expect(staleRegisterErr?.stderr).toContain(
        'CHECK FAILED: operation get_message mcp_tool mismatch: register has null, expected "discord_get_message"',
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
