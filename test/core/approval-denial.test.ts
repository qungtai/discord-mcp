import { describe, expect, it } from "vitest";
import { PPolicyEngine } from "../../src/core/policy.js";
import { PToolRegistry, TOOLSETS } from "../../src/core/tool-registry.js";
import { errorOf, harness } from "../support/harness.js";

// Minimal valid input per approval tool; the denial happens after validation and before any request.
const ARGUMENTS: Record<string, Record<string, unknown>> = {
  discord_add_guild_member_role: { guild_id: "1", user_id: "2", role_id: "3" },
  discord_ban_user_from_guild: { guild_id: "1", user_id: "2" },
  discord_bulk_ban_users_from_guild: { guild_id: "1", user_ids: ["2"] },
  discord_bulk_delete_invite_target_users: { code: "abc", user_ids: ["2"] },
  discord_bulk_delete_messages: { channel_id: "1", message_ids: ["2", "3"] },
  discord_bulk_update_guild_channels: { guild_id: "1", channels: [{ id: "2", position: 1 }] },
  discord_bulk_update_guild_roles: { guild_id: "1", roles: [{ id: "2", position: 1 }] },
  discord_create_auto_moderation_rule: {
    guild_id: "1",
    name: "spam",
    event_type: 1,
    trigger_type: 1,
    actions: [{ type: 1 }],
  },
  discord_create_channel_invite: { channel_id: "1" },
  discord_create_guild_channel: { guild_id: "1", name: "ops" },
  discord_create_guild_role: { guild_id: "1" },
  discord_delete_all_message_reactions: { channel_id: "1", message_id: "2" },
  discord_delete_all_message_reactions_by_emoji: { channel_id: "1", message_id: "2", emoji: "👍" },
  discord_delete_auto_moderation_rule: { guild_id: "1", rule_id: "2" },
  discord_delete_channel: { channel_id: "1" },
  discord_delete_channel_permission_overwrite: { channel_id: "1", overwrite_id: "2" },
  discord_delete_guild_integration: { guild_id: "1", integration_id: "2" },
  discord_delete_guild_member: { guild_id: "1", user_id: "2" },
  discord_delete_guild_member_role: { guild_id: "1", user_id: "2", role_id: "3" },
  discord_delete_guild_role: { guild_id: "1", role_id: "2" },
  discord_delete_guild_scheduled_event: { guild_id: "1", guild_scheduled_event_id: "2" },
  discord_delete_guild_scheduled_event_exception: {
    guild_id: "1",
    guild_scheduled_event_id: "2",
    exception_id: "3",
  },
  discord_delete_guild_template: { guild_id: "1", code: "abc" },
  discord_delete_invite: { code: "abc" },
  discord_delete_invite_target_user: { code: "abc", user_id: "2" },
  discord_delete_message: { channel_id: "1", message_id: "2" },
  discord_delete_thread_member: { channel_id: "1", user_id: "2" },
  discord_delete_user_message_reaction: {
    channel_id: "1",
    message_id: "2",
    emoji: "👍",
    user_id: "3",
  },
  discord_prune_guild: { guild_id: "1" },
  discord_review_guild_join_request: { guild_id: "1", request_id: "2", action: "APPROVED" },
  discord_set_channel_permission_overwrite: { channel_id: "1", overwrite_id: "2", type: 0 },
  discord_set_invite_target_users: { code: "abc", file: { path: "users.csv" } },
  discord_sync_guild_template: { guild_id: "1", code: "abc" },
  discord_unban_user_from_guild: { guild_id: "1", user_id: "2" },
  discord_update_auto_moderation_rule: { guild_id: "1", rule_id: "2" },
  discord_update_channel: { channel_id: "1" },
  discord_update_guild: { guild_id: "1" },
  discord_update_guild_incident_actions: { guild_id: "1" },
  discord_update_guild_member: { guild_id: "1", user_id: "2" },
  discord_update_guild_onboarding: { guild_id: "1" },
  discord_update_guild_role: { guild_id: "1", role_id: "2" },
  discord_update_guild_scheduled_event: { guild_id: "1", guild_scheduled_event_id: "2" },
  discord_update_guild_scheduled_event_exception: {
    guild_id: "1",
    guild_scheduled_event_id: "2",
    exception_id: "3",
  },
  discord_update_guild_template: { guild_id: "1", code: "abc" },
  discord_update_guild_welcome_screen: { guild_id: "1" },
  discord_update_guild_widget_settings: { guild_id: "1" },
  discord_update_voice_channel_status: { channel_id: "1", status: "live" },
};

const approvalTools = (await PToolRegistry.load()).list().filter((tool) => tool.approval);

describe("approval denial without elicitation", () => {
  it("covers every approval tool", () => {
    expect(approvalTools.map((tool) => tool.name).filter((name) => !(name in ARGUMENTS))).toEqual(
      [],
    );
  });

  it.each(approvalTools.map((tool) => [tool.name, ARGUMENTS[tool.name]] as const))(
    "%s is refused without sending a request",
    async (name, args) => {
      const { client, makeRequest } = await harness({
        policy: new PPolicyEngine([], TOOLSETS, false),
        clientCapabilities: {},
      });
      const result = await client.callTool({ name, arguments: args });
      expect(errorOf(result)).toMatchObject({
        category: "policy",
        retryable: false,
        message: "This tool needs approval but the client does not support elicitation",
        remediation:
          "Use an MCP client that supports elicitation, or set DISCORD_MCP_APPROVAL=none to rely on the client's own tool approval",
      });
      expect(makeRequest).not.toHaveBeenCalled();
    },
  );
});
