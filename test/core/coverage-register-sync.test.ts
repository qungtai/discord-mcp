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
});
