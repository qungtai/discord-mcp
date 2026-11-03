# Discord API coverage report

Generated from pinned baseline. Counts are raw inventory totals; they are **not** parity claims.

## Baseline

- Repository: `discord/discord-api-spec`
- Commit: `4e75626a4cedfbc397d66f5491c79a9a62a71fd5`
- Retrieved at: 2026-11-02T17:56:36.927Z
- Stable operations: 250
- Preview-only operations: 0

## Totals by group

| Group | Operations |
| --- | ---: |
| applications | 33 |
| channels | 50 |
| gateway | 2 |
| guilds | 93 |
| interactions | 1 |
| invites | 9 |
| lobbies | 15 |
| oauth2 | 4 |
| partner-sdk | 5 |
| skus | 2 |
| soundboard-default-sounds | 1 |
| stage-instances | 4 |
| sticker-packs | 2 |
| stickers | 1 |
| users | 12 |
| voice | 1 |
| webhooks | 15 |
| **Total** | **250** |

## Implementation status

| Implementation | Count |
| --- | ---: |
| implemented | 114 |
| unmapped | 136 |

## Availability status

| Availability | Count |
| --- | ---: |
| unknown | 250 |

## Verification status

| Verification | Count |
| --- | ---: |
| live action verified | 39 |
| mocked contract tested | 75 |
| not_tested | 136 |

## Per-group status dimensions

| Group | Ops | Implementation | Availability | Verification |
| --- | ---: | --- | --- | --- |
| applications | 33 | unmapped=33 | unknown=33 | not_tested=33 |
| channels | 50 | implemented=45, unmapped=5 | unknown=50 | live action verified=20, mocked contract tested=25, not_tested=5 |
| gateway | 2 | unmapped=2 | unknown=2 | not_tested=2 |
| guilds | 93 | implemented=69, unmapped=24 | unknown=93 | live action verified=19, mocked contract tested=50, not_tested=24 |
| interactions | 1 | unmapped=1 | unknown=1 | not_tested=1 |
| invites | 9 | unmapped=9 | unknown=9 | not_tested=9 |
| lobbies | 15 | unmapped=15 | unknown=15 | not_tested=15 |
| oauth2 | 4 | unmapped=4 | unknown=4 | not_tested=4 |
| partner-sdk | 5 | unmapped=5 | unknown=5 | not_tested=5 |
| skus | 2 | unmapped=2 | unknown=2 | not_tested=2 |
| soundboard-default-sounds | 1 | unmapped=1 | unknown=1 | not_tested=1 |
| stage-instances | 4 | unmapped=4 | unknown=4 | not_tested=4 |
| sticker-packs | 2 | unmapped=2 | unknown=2 | not_tested=2 |
| stickers | 1 | unmapped=1 | unknown=1 | not_tested=1 |
| users | 12 | unmapped=12 | unknown=12 | not_tested=12 |
| voice | 1 | unmapped=1 | unknown=1 | not_tested=1 |
| webhooks | 15 | unmapped=15 | unknown=15 | not_tested=15 |

## Operations by toolset (from coverage/tools.json)

| Toolset | Count |
| --- | ---: |
| channels | 14 |
| events | 11 |
| guild | 22 |
| invites | 2 |
| members | 12 |
| messages | 17 |
| moderation | 10 |
| reactions | 6 |
| roles | 7 |
| threads | 13 |
| unmapped | 136 |

## MCP tool mapping

| Operation | MCP tool(s) |
| --- | --- |
| delete_channel | discord_delete_channel |
| delete_message | discord_delete_message |
| delete_all_message_reactions | discord_delete_all_message_reactions |
| delete_all_message_reactions_by_emoji | discord_delete_all_message_reactions_by_emoji |
| delete_user_message_reaction | discord_delete_user_message_reaction |
| delete_my_message_reaction | discord_delete_my_message_reaction |
| delete_pin | discord_delete_pin |
| delete_channel_permission_overwrite | discord_delete_channel_permission_overwrite |
| deprecated_delete_pin | discord_delete_pin |
| delete_thread_member | discord_delete_thread_member |
| leave_thread | discord_leave_thread |
| get_channel | discord_get_channel |
| list_channel_invites | discord_list_channel_invites |
| list_messages | discord_list_messages |
| get_message | discord_download_attachment, discord_edit_message, discord_get_message |
| list_message_reactions_by_emoji | discord_list_message_reactions_by_emoji |
| list_pins | discord_list_pins |
| get_channel_member_permissions | discord_get_member_permissions |
| get_channel_role_permissions | discord_get_role_permissions |
| deprecated_list_pins | discord_list_pins |
| get_answer_voters | discord_list_poll_answer_voters |
| list_thread_members | discord_list_thread_members |
| get_thread_member | discord_get_thread_member |
| list_private_archived_threads | discord_list_private_archived_threads |
| list_public_archived_threads | discord_list_public_archived_threads |
| thread_search | discord_search_threads |
| list_my_private_archived_threads | discord_list_my_private_archived_threads |
| update_channel | discord_update_channel |
| update_message | discord_edit_message |
| follow_channel | discord_follow_channel |
| create_channel_invite | discord_create_channel_invite |
| create_message | discord_send_message |
| crosspost_message | discord_crosspost_message |
| create_thread_from_message | discord_create_thread_from_message |
| bulk_delete_messages | discord_bulk_delete_messages |
| poll_expire | discord_end_poll |
| create_thread | discord_create_thread |
| trigger_typing_indicator | discord_trigger_typing_indicator |
| add_my_message_reaction | discord_add_my_message_reaction |
| create_pin | discord_create_pin |
| set_channel_permission_overwrite | discord_set_channel_permission_overwrite |
| deprecated_create_pin | discord_create_pin |
| add_thread_member | discord_add_thread_member |
| join_thread | discord_join_thread |
| update_voice_channel_status | discord_update_voice_channel_status |
| delete_auto_moderation_rule | discord_delete_auto_moderation_rule |
| unban_user_from_guild | discord_unban_user_from_guild |
| delete_guild_integration | discord_delete_guild_integration |
| delete_guild_member | discord_delete_guild_member |
| delete_guild_member_role | discord_delete_guild_member_role |
| delete_guild_role | discord_delete_guild_role |
| delete_guild_scheduled_event | discord_delete_guild_scheduled_event |
| delete_guild_scheduled_event_exception | discord_delete_guild_scheduled_event_exception |
| delete_guild_template | discord_delete_guild_template |
| get_guild | discord_get_guild |
| list_guild_audit_log_entries | discord_list_guild_audit_log_entries |
| list_auto_moderation_rules | discord_list_auto_moderation_rules |
| get_auto_moderation_rule | discord_get_auto_moderation_rule |
| list_guild_bans | discord_list_guild_bans |
| get_guild_ban | discord_get_guild_ban |
| list_guild_channels | discord_list_guild_channels |
| list_guild_integrations | discord_list_guild_integrations |
| list_guild_members | discord_list_guild_members |
| get_guild_member | discord_get_guild_member |
| search_guild_members | discord_search_guild_members |
| guild_search | discord_search_guild_messages |
| get_guild_new_member_welcome | discord_get_guild_new_member_welcome |
| get_guilds_onboarding | discord_get_guild_onboarding |
| get_guild_member_permissions | discord_get_member_permissions |
| get_guild_role_permissions | discord_get_role_permissions |
| get_guild_preview | discord_get_guild_preview |
| preview_prune_guild | discord_preview_prune_guild |
| get_guild_join_requests | discord_list_guild_join_requests |
| list_guild_roles | discord_list_guild_roles |
| get_guild_role | discord_get_guild_role |
| guild_role_member_counts | discord_get_guild_role_member_counts |
| list_guild_scheduled_events | discord_list_guild_scheduled_events |
| get_guild_scheduled_event | discord_get_guild_scheduled_event |
| list_guild_scheduled_event_exception_users | discord_list_guild_scheduled_event_exception_users |
| list_guild_scheduled_event_users | discord_list_guild_scheduled_event_users |
| count_guild_scheduled_event_users | discord_count_guild_scheduled_event_users |
| list_guild_templates | discord_list_guild_templates |
| get_active_guild_threads | discord_list_active_guild_threads |
| get_guild_vanity_url | discord_get_guild_vanity_url |
| get_guild_welcome_screen | discord_get_guild_welcome_screen |
| get_guild_widget_settings | discord_get_guild_widget_settings |
| get_guild_widget | discord_get_guild_widget |
| get_guild_template | discord_get_guild_template |
| update_guild | discord_update_guild |
| update_auto_moderation_rule | discord_update_auto_moderation_rule |
| bulk_update_guild_channels | discord_bulk_update_guild_channels |
| update_guild_member | discord_update_guild_member |
| update_my_guild_member | discord_update_my_guild_member |
| action_guild_join_request | discord_review_guild_join_request |
| bulk_update_guild_roles | discord_bulk_update_guild_roles |
| update_guild_role | discord_update_guild_role |
| update_guild_scheduled_event | discord_update_guild_scheduled_event |
| update_guild_scheduled_event_exception | discord_update_guild_scheduled_event_exception |
| update_guild_template | discord_update_guild_template |
| update_guild_welcome_screen | discord_update_guild_welcome_screen |
| update_guild_widget_settings | discord_update_guild_widget_settings |
| create_auto_moderation_rule | discord_create_auto_moderation_rule |
| bulk_ban_users_from_guild | discord_bulk_ban_users_from_guild |
| create_guild_channel | discord_create_guild_channel |
| prune_guild | discord_prune_guild |
| create_guild_role | discord_create_guild_role |
| create_guild_scheduled_event | discord_create_guild_scheduled_event |
| create_guild_scheduled_event_exception | discord_create_guild_scheduled_event_exception |
| create_guild_template | discord_create_guild_template |
| ban_user_from_guild | discord_ban_user_from_guild |
| update_guild_incident_actions | discord_update_guild_incident_actions |
| add_guild_member_role | discord_add_guild_member_role |
| put_guilds_onboarding | discord_update_guild_onboarding |
| sync_guild_template | discord_sync_guild_template |

## Operations by credential profile

| Credential profile | Count |
| --- | ---: |
| bot | 187 |
| bot, oauth2 | 36 |
| interaction_token, bot | 1 |
| none, bot | 9 |
| oauth2 | 5 |
| webhook_token, bot | 12 |

## Preview-only operations

None at this baseline.

> Note: Implementation, availability and verification are tracked as independent dimensions. A count of unmapped operations is an inventory fact, not a claim of missing or complete functionality.
