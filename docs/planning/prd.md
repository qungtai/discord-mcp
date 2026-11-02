# Discord MCP: community server with traceable API coverage

Version: 0.2 draft. Date: 3 November 2026. Supersedes v0.1 (`discord-mcp-prd.md`, kept unchanged for history).

Owner: requesting user. Audience: product owner, architect, implementation agents, reviewers, release maintainer and future community contributors.

Status: proposed requirements for review. No implementation, new repository, package publication, permission expansion, destructive live testing or production MCP switch is approved by this document alone.

## 0. What changed from v0.1

- The product is a general-purpose, open-source Discord MCP server for the community. It is not built around the owner's server, a client or the Monday-to-Discord workflow. Those remain test fixtures and acceptance examples only.
- Success is measured by breadth of tools, integrations and capabilities against Discord's documented API, with honest coverage evidence.
- New sections: MCP standard compliance (section 7), multi-client support, distribution through standard open-source channels (section 12), upstream-versus-fork strategy (section 13) and community maintenance.
- Personas and use cases now describe community users rather than one operator.
- File requirements now list the full attachment lifecycle confirmed against current Discord documentation (section 9).
- Safety controls are configurable with secure defaults, because unknown users will run the server against their own guilds.
- Appendix A adds the draft tool catalog: 207 tools mapped to 250 HTTP operations, grouped into toolsets.

## 1. Product objective

Ship a standards-compliant MCP server that any MCP client can install and use to work with Discord, exposing the broadest practical set of documented Discord capabilities with complete supported parameters, and publishing a coverage report that shows exactly what is implemented, executable, blocked, deferred and verified.

Completeness means measured coverage of a pinned public API baseline plus declared non-HTTP surfaces. It does not mean unrestricted access to Discord, a fixed number of tools, or a claim derived from tool counts.

## 2. Requirements stated by the owner

| ID | Requirement |
| --- | --- |
| U-01 | Compare MCP capabilities against Discord's API, not merely against other MCP servers. |
| U-02 | Cover broad Discord integration, not only message and file functions. |
| U-03 | Support text, formatting, message editing, images, PDFs, other file uploads, adding files to existing messages and attachment downloads. |
| U-04 | Demonstrate capabilities through real tests; listing tools, schema validation or rejecting invalid input is insufficient. |
| U-05 | In the owner's environment, keep agent and MCP configuration in `~/.agents` and propagate it through `agents-sync`. |
| U-06 | Preserve existing credentials and configuration (current `discord` and `discord-pasympa` entries) and allow rollback. |
| U-07 | Supply a detailed PRD and recommendations that agents can execute. |
| U-08 | Build a general-purpose community tool, not a tool for one person, client or use case. |
| U-09 | Follow the current MCP standard so the server integrates with many clients and platforms. |
| U-10 | Prioritize having enough tools, integration options and capabilities in the MCP itself. |
| U-11 | Install like a standard open-source MCP server; no bespoke installation path. |
| U-12 | Cover the full attachment lifecycle: upload, keep, add, remove, replace, update alt text and spoiler, read metadata and download. |
| U-13 | Track implementation, credential availability and live verification separately; record every unsupported or blocked operation explicitly; never claim full parity without the coverage report supporting it. |
| U-14 | Use a dedicated test server and controlled test accounts for destructive or administrative tests. Do not modify production Discord resources, expand permissions, commit, push, publish or switch the production MCP without authorization. Never print or commit credentials. |

The owner previously expressed a preference for GPT-6 Luna subagent teams. Staffing, worktree use and which agent writes code are open decisions (section 17); never invent model names or silently substitute an unavailable model.

## 3. Proposed defaults requiring owner review

| Decision | Proposed default | Why |
| --- | --- | --- |
| Language/runtime | TypeScript on a maintained Node LTS | Matches the leading candidates and the official MCP TypeScript SDK. |
| Transports | stdio and Streamable HTTP from the first release | stdio covers desktop and CLI clients; HTTP is required for remote clients such as ChatGPT connectors. |
| Distribution | npm package as the primary channel; Docker image as secondary; MCP Registry listing | npm via `npx` is the standard install path for TypeScript MCP servers. |
| License | MIT, subject to the license of any forked base | All evaluated candidates are MIT; confirm before reuse. |
| Base | Decide upstream contribution, fork or new core only after the spike in section 13 | Avoid another replacement based on advertised tool count. |
| Hosting | Self-hosted only; the project does not run a public service | A hosted service adds tenancy, abuse handling and cost the project cannot own yet. |
| Credential profiles | Bot first; webhook, OAuth user and app-owner profiles added by phase | Most community use is bot-based; other profiles need different setup. |
| Tool exposure | Domain tools grouped into toolsets, with a small default set; optional registry-backed discovery | A 200+ tool catalog overwhelms clients if advertised at once. |
| Voice media | Separate phase with its own acceptance criteria | Media transport and E2EE (DAVE) requirements differ from HTTP management. |

The complete public API goal is retained. A deferred phase must not be called implemented or counted as covered.

## 4. Personas

| ID | Persona | Needs |
| --- | --- | --- |
| P1 | Individual using an MCP client (Claude, ChatGPT, Codex, Cursor, VS Code and others) | Install in minutes, post and manage messages and files, read history, run common admin tasks. |
| P2 | Community server administrator or moderator | Channels, roles, members, moderation, AutoMod, events and audit, with safe guardrails. |
| P3 | Discord application developer | Commands, interactions, webhooks, emojis, entitlements and app metadata through the right credential. |
| P4 | Self-hoster or platform operator | Run the HTTP transport for a team or a remote client with authentication, allowlists and logs. |
| P5 | Agent or automation builder | Predictable schemas, structured output, pagination, idempotency guidance and clear errors. |
| P6 | Maintainer and contributor | Pinned baseline, drift detection, coverage report, reproducible tests and a documented release path. |

## 5. Use cases

| Use case | Persona | Expected result |
| --- | --- | --- |
| UC-01 Publish an update | P1, P5 | Send formatted text, embeds, components, polls and local files to an exact channel; return message ID and link. |
| UC-02 Correct an existing message | P1, P5 | Edit bot-authored text, embeds and attachments; add, keep, remove, replace or update attachment metadata without losing unrelated content. |
| UC-03 Retrieve evidence | P1, P5 | Read paginated history and search; inspect attachments; download authorized files with hashes. |
| UC-04 Manage server resources | P2 | Create, read, update and delete channels, threads, roles, events, invites, webhooks and expressions under explicit policy. |
| UC-05 Moderate | P2 | Inspect effective permissions, preview destructive changes, apply approved actions and audit results. |
| UC-06 Operate an application | P3 | Manage commands, permissions, interactions, emojis and entitlements with the correct profile. |
| UC-07 Observe Discord changes | P3, P5 | Receive supported Gateway events, recover from disconnects and expose delivery and replay semantics. |
| UC-08 Self-host for a team | P4 | Run Streamable HTTP with authentication, guild allowlists and audit logging. |
| UC-09 Maintain compatibility | P6 | Detect API changes, missing fields, obsolete tools and regressions before release. |

## 6. Definition and measurement of coverage

FR-COV-01 (MUST, P6/UC-09): Pin official specification and documentation revisions, retrieval time and content hashes. The `discord-api-spec` repository can be pinned by commit; the documentation site has no revision identifier, so record retrieval time and content hashes of each page used. Keep stable and preview specifications separate. Use current documentation to resolve known spec discrepancies and record every override.

FR-COV-02 (MUST): Inventory every method-and-path operation in the selected HTTP baseline. Add documented operations missing from the spec through reviewed additions. Inventory Gateway events, interactions and voice separately; do not merge them into one HTTP coverage percentage.

FR-COV-03 (MUST): Each operation record includes:

- Stable capability ID, API operation ID, method and path, source revision and documentation link.
- Credential types and scopes, application approval requirements, permissions, intents and target-resource prerequisites.
- MCP tool mapping, tool version, parameter and response mappings and known unsupported fields.
- Lifecycle status, owner, priority and dependencies.
- Implementation status, runtime availability and verification status as independent fields.
- Test IDs, timestamps, package and spec revision, resource IDs or redacted evidence, cleanup status and blockers.

FR-COV-04 (MUST): Status dimensions must not conflate unlike claims:

| Dimension | Example values |
| --- | --- |
| Implementation | unmapped, planned, partial, implemented, deferred, obsolete |
| Availability | executable, missing credential, missing permission, Discord approval required, unavailable fixture |
| Verification | not tested, schema tested, mocked contract tested, preview tested, live action verified |

FR-COV-05 (MUST): Full HTTP coverage requires every baseline operation mapped and every documented applicable request field supported or explicitly justified. A generic HTTP pass-through or tool-name similarity is not evidence of semantic implementation.

FR-COV-06 (MUST): Report raw totals: baseline operations, full and partial implementations, executable operations, live-verified operations and blockers. Publish global and per-credential-profile views. Do not remove inaccessible operations from the global denominator.

FR-COV-07 (MUST): A release may claim "complete for profile X at revision Y" only when every operation in that profile meets its implementation and verification gates. Never claim "all Discord functions" from HTTP or tool counts.

FR-COV-08 (MUST): Publish the coverage report with every release and expose it at runtime through a `get_coverage` tool or resource.

## 7. MCP standard compliance and client integration

FR-MCP-01 (MUST): Target MCP specification revision 2025-11-25, recorded in the baseline. Track later revisions through the same drift process as the Discord API.

FR-MCP-02 (MUST): Implement both stdio and Streamable HTTP transports from one codebase with identical tool behavior. In stdio mode stdout carries only protocol messages; logs go to stderr.

FR-MCP-03 (MUST): Use standard protocol features rather than custom ones:

- Tools with `inputSchema`, `outputSchema` and `structuredContent` alongside readable text.
- Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) that match actual behavior.
- Server logging through the standard `notifications/message` mechanism. Custom notification methods are not allowed; at least one existing community server emits a non-standard `log` notification that Codex reports as unexpected.
- Progress notifications for long uploads, downloads and bulk operations; honor cancellation.
- Cursor pagination for large reads.

FR-MCP-04 (SHOULD): Expose read-only data that suits resources, such as attachments by URI and the coverage report, as MCP resources in addition to tools. Tools remain the primary interface because client resource support varies.

FR-MCP-05 (MUST): Streamable HTTP mode follows the MCP security guidance: bind to localhost by default, validate `Origin`, manage sessions, and support the MCP Authorization flow (OAuth 2.1 resource server) or an operator-configured bearer token. HTTP mode must never run unauthenticated on a non-local interface without an explicit, logged opt-out.

FR-MCP-06 (MUST): Maintain a client compatibility matrix with tested versions. Minimum set: Claude Code, Claude Desktop, Codex CLI and Codex Desktop, Cursor, VS Code, and one remote HTTP client (ChatGPT connector or MCP Inspector over HTTP). A passing standalone process does not prove a client loaded the server; verify in a fresh client session.

FR-MCP-07 (MUST): Tool exposure is configurable through toolsets. The default set stays small enough for common clients; the full catalog remains available. Document which toolsets each client handles well. Hiding tools must not be reported as missing coverage, and registering tools must stay honest about implementation status.

FR-MCP-08 (SHOULD): Offer an optional registry-backed discovery tool that lists operations by capability and returns their schemas, so clients can reach non-default toolsets without advertising every tool. It may only invoke enumerated operations from the pinned registry (see FR-AUTH-05).

FR-MCP-09 (MUST): Tool names are stable, versioned and prefixed `discord_`. Renames follow a deprecation period with aliases and release notes.

## 8. Functional scope

All areas are MUST for the final declared scope, subject to Discord access constraints and recorded owner decisions. Phase order does not change final priority. Appendix A maps the areas to the draft tool catalog.

| Area | Required capability inventory |
| --- | --- |
| Messages | Send, read, fetch, edit, delete; replies, forwarding and crossposting; pagination; search; bulk delete; pins; reactions and reacting users; typing; polls with voters and expiry; allowed mentions, flags, nonce and message references. |
| Files and media | Full attachment lifecycle in section 9. |
| Rich content | Embeds, Components V2, polls and interaction responses. Track Discord restrictions on combinations instead of assuming every option is compatible. |
| Channels and threads | All channel types and fields, ordering, permission overwrites, effective permissions, followers, invites, threads, archives, thread members, forum and media channels, tags and posts, voice channel status. |
| Guilds | Settings, preview, audit log, widget, onboarding, welcome screen, templates, integrations, incident actions, vanity URL, join requests. |
| Members and roles | Read, search, add, update, remove members; timeouts; role CRUD, ordering, member counts and assignment; prune with preview; hierarchy-aware results. |
| Moderation | Bans and bulk bans, AutoMod rule lifecycle, audit-friendly outcomes. |
| Webhooks | Create, get, list, edit, delete; execute with files, embeds, threads and compatibility formats; retrieve, edit and delete webhook messages; token handling. |
| Scheduled events | CRUD, recurrence exceptions, subscribers and counts. |
| Expressions | Guild and application emojis, stickers and packs, soundboard lifecycle and sending. |
| Voice and stage | Regions, voice states, stage instances; media transport assessed separately (section 11). |
| Users, DMs and OAuth | Current user, DMs and group DMs, connections, role connections, OAuth authorization info; no personal-account automation. |
| Applications | Metadata, global and guild commands, command permissions, role-connection metadata, attachments, activity instances. |
| Monetization and specialized | Entitlements, SKU subscriptions, lobbies and Social SDK operations with appropriate prerequisites. |
| Real-time | Gateway events, interaction reception and webhook events (section 11). |

FR-FUNC-01 (MUST): Decompose each area against current documentation. This table is a discovery checklist; the coverage register is authoritative.

FR-FUNC-02 (MUST): Tools return structured identifiers, outcome and relevant metadata. Reads return rich fields when requested: attachments, embeds, components, reactions, references, thread indicators and edit times.

FR-FUNC-03 (MUST): Support exact ID targeting. Name resolution rejects ambiguity and returns candidates; fuzzy matching never selects mutation targets silently.

FR-FUNC-04 (MUST): Distinguish omitted values from explicit null, support partial edits, validate snowflakes without numeric precision loss, and enforce documented limits and legal field combinations.

FR-FUNC-05 (MUST): Support multiple guilds per credential; no tool assumes a single default guild unless the operator configures one.

## 9. Attachments and files

Behavior confirmed in current Discord documentation on 3 November 2026; items marked "verify" need live tests.

| Capability | Discord mechanism | Requirement |
| --- | --- | --- |
| Upload on send | `multipart/form-data` with `files[n]` and `payload_json.attachments[]` (`id`, `filename`, `title`, `description`, `is_spoiler`) | FR-FILE-01 |
| Alt text and spoiler | `description` (max 1024 chars), `is_spoiler`; legacy `SPOILER_` prefix still honored | FR-FILE-01 |
| Add to existing message | `PATCH` with new `files[n]`; `attachments[]` must list every attachment to keep (v10) | FR-FILE-02 |
| Keep unchanged | Omit `attachments` on edit | FR-FILE-02 |
| Remove or replace | `PATCH` with `attachments[]` excluding removed IDs, plus new files | FR-FILE-02 |
| Update existing metadata | `PATCH` with `{id, description, is_spoiler}`; filename and title are not editable | FR-FILE-02 |
| Read metadata | Message payload: `id, filename, title, description, content_type, size, url, proxy_url, width, height, duration_secs, waveform, flags` | FR-FILE-03 |
| Download | `GET attachment.url`; signed URLs expire (`ex`, `is`, `hm`); re-fetch the message for a fresh URL; `proxy_url` returns 415 for non-media types | FR-FILE-03, FR-FILE-05 |
| Embed and component references | `attachment://filename` for jpg, jpeg, png, webp, gif; Components V2 File, Media Gallery, Thumbnail | FR-FILE-07 |
| Voice messages | `IS_VOICE_MESSAGE`, one `audio/*` file with `duration_secs` and `waveform`; cannot be edited | FR-FILE-08 |
| Content scanning flags | Explicit, gore and self-harm flags may be added after sending | FR-FILE-09 |
| Other carriers | Webhook messages, forum and thread starters, forwarded snapshots, interaction responses, stickers, application attachments | FR-FILE-10 |
| Limits | Default 20 MiB per file since 3 September 2026, higher with boosts; the Message page still states a 25 MiB request limit (verify); maximum files per message not stated in the pages read (verify) | FR-FILE-11 |

FR-FILE-01 (MUST): Upload one or more local files from operator-configured readable roots, including image, PDF and text. Set filename, MIME type, alt text and spoiler. Respect effective size limits reported by Discord instead of hardcoding a universal limit.

FR-FILE-02 (MUST): Edit attachments on bot-authored messages: add, keep, remove, replace and update `description` and `is_spoiler`, preserving text, embeds and other attachments unless explicitly changed. Return the final attachment set.

FR-FILE-03 (MUST): Download an attachment identified by channel, message and attachment ID into an operator-configured output directory. Prevent traversal, symlink escapes and overwriting unrelated files. Return filename, size, MIME type, local path and SHA-256.

FR-FILE-04 (MUST): Do not pass base64 file contents through the model for local workflows. For HTTP mode define an upload and download artifact protocol (for example resource URIs or presigned local endpoints) with size caps and retention before enabling file tools remotely.

FR-FILE-05 (MUST): Refresh expired CDN URLs by re-fetching message metadata. Validate redirects, restrict fetches to Discord CDN hosts, cap bytes and time, and never forward credentials to attachment hosts.

FR-FILE-06 (MUST): Never execute downloaded content. Cleanup follows the approved ownership and retention policy; user deliverables survive test cleanup.

FR-FILE-07 (MUST): Support `attachment://` references in embeds and Components V2 media.

FR-FILE-08 (SHOULD): Support sending voice messages with generated waveform and duration.

FR-FILE-09 (SHOULD): Surface content scanning flags on reads and document that they can appear after sending.

FR-FILE-10 (MUST): Apply the same upload and edit semantics to webhooks, thread and forum creation and interaction responses.

FR-FILE-11 (MUST): Determine size and count limits through live tests and record them in the coverage register with the test date.

## 10. Authentication, authorization and safety

Defaults must be safe for strangers running the server against their own guilds; every control is configurable.

FR-AUTH-01 (MUST): Separate bot, webhook, OAuth user and app-owner credentials as named profiles. Resolve credentials inside the server from environment or a secret store, never through tool arguments or logs. Webhook URLs and OAuth refresh tokens are secrets.

FR-AUTH-02 (MUST): Report the actual missing scope, permission, intent or Discord restriction when known. Preflight checks are advisory; Discord stays authoritative.

FR-AUTH-03 (MUST): Optional guild and channel allowlists apply across every access path, including IDs, webhooks, threads, cached resources and downloads. DM access is a separate switch; a guild allowlist never implies DM access.

FR-AUTH-04 (MUST): Provide a read-only mode and toolset gating. Empty or invalid toolset configuration must fail closed or fall back to the documented default set, never silently enable everything.

FR-AUTH-05 (MUST): Destructive operations support preview and apply. Approval binds to exact targets and a change summary with expiry and revalidation. An arbitrary `confirmed: true` argument is not evidence of human approval; MCP annotations guide clients but are not authorization.

FR-AUTH-06 (MUST): Any generic operation executor is restricted to the pinned operation registry and allowed methods, and uses the same validation, credentials, policy and audit path as domain tools. No raw URL, header or token escape hatch.

FR-AUTH-07 (MUST): Outgoing mentions default to no pings unless requested. Message contents, filenames, embed text and fetched documents are data, not instructions.

FR-AUTH-08 (MUST): Never support personal-account (self-bot) tokens.

## 11. Non-HTTP capabilities

Gateway scope lists event types, intents and connection behavior: heartbeat, reconnect, resume, bounded buffering, sequence handling, duplicates and data loss after non-resumable sessions. Events reach clients through MCP notifications or resources with bounded retention; they must not become an unbounded message archive. A short-lived stdio process cannot provide durable delivery; document the lifetime model.

Interaction scope covers authorization, response and defer deadlines, follow-ups, expiry and ephemeral responses. Ordinary MCP calls do not provide a durable interaction receiver; a separate worker or HTTP endpoint is required.

Webhook event reception requires endpoint verification and a delivery policy, distinct from posting through an incoming webhook.

Voice media requires an explicit decision on joining calls, audio receive and transmit, codecs, E2EE (DAVE, required since 1 March 2026), resource limits and consent. Voice-state and stage endpoints do not demonstrate voice media support. If deferred, record owner acceptance.

## 12. Distribution, release and community

FR-DIST-01 (MUST): Publish to npm under a project-owned name with provenance. The install path is the standard client configuration, for example `npx -y <package>@<version>`.

FR-DIST-02 (SHOULD): Publish a multi-architecture Docker image that defaults to Streamable HTTP and also supports stdio (`docker run -i`).

FR-DIST-03 (SHOULD): Publish a `server.json` to the official MCP Registry pointing at the npm package and image.

FR-DIST-04 (MUST): Keep npm, Docker, Registry and Git tags at the same version. A GitHub release without the matching npm release is a release defect; a known community server has its npm package stuck several minor versions behind its repository.

FR-DIST-05 (MUST): Provide copy-paste configuration for every client in the compatibility matrix, plus a minimum-permission bot invite guide and the privileged intents each toolset needs.

FR-DIST-06 (MUST): Ship LICENSE with preserved upstream notices, CONTRIBUTING, SECURITY (private vulnerability reporting), CHANGELOG and a code of conduct.

FR-DIST-07 (MUST): CI runs unit, contract and protocol tests on every change, checks API drift against the pinned baseline, scans for secrets and blocks releases on coverage regressions. Live tests are opt-in through contributor-supplied credentials for their own test guild and never run with project secrets on untrusted pull requests.

FR-DIST-08 (MUST): Semantic versioning; release notes list tool and parameter changes, deprecations and migration steps.

## 13. Base selection: upstream, fork or new core

Candidates already cloned for evaluation: PaSympa/discord-mcp (MIT, TypeScript, 99 tools, active), HardHeadHackerHead/discord-mcp and jonasgantner/discord-mcp. Others observed: barryyip0625/mcp-discord (npm stale at 1.3.4, GitHub at 1.5.1) and SaseQ/discord-mcp (Java, Streamable HTTP).

| Option | Benefits | Costs |
| --- | --- | --- |
| Contribute upstream (likely PaSympa) | Existing users and maintainer; avoids fragmenting the community | Depends on maintainer review and architecture fit; a coverage registry may be a large change for them. |
| Fork | Full control over architecture with a head start | Owns maintenance; must attract users away from upstream. |
| New core with reused adapters | Clean coverage model, consistent policy and transport | Most foundation work; still must attract users. |

Every candidate runs the same spike: install through the standard client path; send a local image and PDF; read full metadata; edit while retaining attachments; remove and replace one; download and hash-check; deny a forbidden guild; start in a fresh Codex and Claude session; and pass a Streamable HTTP check. Also score license, test architecture, MCP spec compliance, release hygiene and maintainer responsiveness. Record results in the register; tool count is not a criterion.

## 14. Reliability and operations

NFR-01 (MUST): Honor per-route and global rate limits and retry signals; bound retries and timeouts; never blindly retry an uncertain non-idempotent send.

NFR-02 (MUST): Return confirmed versus uncertain outcomes. Use Discord nonce behavior and reconciliation where available; do not claim exactly-once delivery.

NFR-03 (MUST): No startup output, error or log contains tokens, authorization headers or webhook URLs.

NFR-04 (MUST): Constrain output sizes, stream files, paginate reads and expose truncation and cursors.

NFR-05 (MUST): Structured errors with operation and resource identifiers, category, retryability and remediation. A schema rejection, preview or HTTP acknowledgement is never reported as a verified end state.

NFR-06 (MUST): Start with Gateway disabled for HTTP-only use; readiness distinguishes MCP transport, Discord authentication and optional subsystems. Proposed targets: ready within 10 seconds with dependencies installed; simple read p95 within 5 seconds in a small guild excluding rate-limit waits. Measure before adopting as release targets.

NFR-07 (MUST): Pin dependencies, preserve license notices and record actual dependency revisions.

NFR-08 (MUST): Audit logs record action, profile, targets, correlation ID, outcome and evidence references, without message bodies or secrets by default. Retention is operator-configurable.

## 15. Owner environment and rollout constraints

These apply to the owner's machine and are not product requirements for community users.

- `~/.agents` is the source of truth. Registry entries live under `mcp/<server>/server.json`, assignments in `matrix.json`, secrets in `~/.agents/.env`. Run `agents-sync --dry-run`, inspect the diff, then apply.
- Preserve the current `discord` (Claude, mcp-discord 1.3.4) and `discord-pasympa` (Codex, @pasympa/discord-mcp 2.2.0) entries for rollback. Staging entries use a distinct server name so tool names do not collide.
- Durable source does not live only in a chat scratch directory. Repository location requires owner approval; no new repository is created without it.
- The bot token was pasted into chat on 2 November 2026; reset it before live tests so evidence uses an uncompromised credential.
- Codex Desktop showed the stdio Discord server stuck at "starting" on 2 November 2026; investigate before relying on Codex Desktop for acceptance.
- No commits, pushes, publication, permission expansion or production switch without the owner's authorization.

## 16. Acceptance scenarios

| ID | Given / action | Required evidence |
| --- | --- | --- |
| AC-01 | Install via the documented `npx` config in a fresh session of each matrix client | Initialized session, advertised schemas, health and credential-profile status per client. |
| AC-02 | Streamable HTTP with authentication enabled | Unauthenticated request rejected; authenticated client lists and calls tools; Origin check enforced. |
| AC-03 | Send image, PDF and text through MCP | Message IDs, links and attachment metadata; read-back. |
| AC-04 | Add a file to an existing message | Same message ID; prior files, text and embeds retained; final attachment list recorded. |
| AC-05 | Remove one attachment and replace another; update alt text and spoiler | Final attachment set and metadata match the request. |
| AC-06 | Download each uploaded attachment | SHA-256 matches the original; path inside the approved root; no secret disclosure. |
| AC-07 | Target a non-allowlisted guild, a forbidden DM or a disallowed path | Rejected before any data is sent; denial evidence. |
| AC-08 | Channel, role, event and webhook lifecycle in the test guild | Exact created IDs, read-back, cleanup ledger, no production mutations. |
| AC-09 | Moderation on a disposable test account | Correct hierarchy and permission handling; authorized effect and recovery where possible. |
| AC-10 | Interrupt a send or hit a rate limit | Bounded recovery, explicit uncertain outcome, no unaccounted duplicates. |
| AC-11 | Gateway events and reconnect | Controlled event generation, delivery record, duplicate and loss behavior. |
| AC-12 | Update the API baseline | New, changed and removed operations detected; coverage regression fails the gate. |
| AC-13 | Specialized OAuth or app operation | Correct profile and scopes; no fallback identity; blocked access reported. |
| AC-14 | Release dry run | npm, Docker, Registry metadata and Git tag versions match; Registry `server.json` validates. |
| AC-15 | Roll back owner configuration | Prior servers work in a fresh session; credentials preserved. |

## 17. Verification and release policy

Test layers: schema validation, mocked transport contracts, MCP protocol integration over both transports, authorized live action with read-back, and real client compatibility. Each answers a different question.

Every operation needs contract tests and permission and error tests. Without credentials or fixtures, mark the operation blocked and attach non-live evidence; never claim live parity.

Test plans list exact resources and side effects before running. Fixtures are named, owned and recorded by run ID. Cleanup deletes only IDs created by that run after approval; never delete by prefix. Bans, delivered DMs, OAuth grants and published announcements need dedicated fixtures because cleanup does not undo them.

Release gates: targeted requirements trace to passing tests; no unclassified baseline operations; no secret leakage; no policy bypass; known limitations published; client matrix and rollback verified; distribution channels consistent. Unit tests alone cannot meet live acceptance.

## 18. Delivery phases

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0: baseline and spike | Pinned register, auth classification, test guild, candidate spike, base decision | All baseline entries classified; owner decisions recorded. |
| 1: foundation and distribution skeleton | Both transports, credentials, policy, rate and error handling, toolsets, npm and Docker pipelines (unpublished) | Protocol and negative tests pass; fresh-client read checks in the matrix. |
| 2: communication | Messages, full attachment lifecycle, embeds, components, polls, reactions, threads, forums, webhooks | AC-03 to AC-07 pass live. |
| 3: administration | Guilds, channels, roles, members, moderation, events, invites, expressions, voice and stage HTTP | Fixture lifecycle and policy tests pass. |
| 4: application profiles | Commands, OAuth user profile, monetization and accessible specialized operations | Per-profile register and available live tests pass; blockers published. |
| 5: real-time and media | Gateway, interaction receiver, webhook events, approved voice scope | Delivery, recovery and media gates pass. |
| 6: parity and 1.0 | Gap closure, docs, migration, drift automation, first public release (with authorization) | Claims match the coverage ledger; release dry run and rollback accepted. |

No calendar or budget is promised. After phase 0 the lead estimates effort per capability, auth dependency and fixture.

## 19. Owner decisions and dependencies

1. Upstream contribution, fork or new core (after the spike), and whether the owner has a preference now.
2. Repository location, project name, npm scope and named maintainer.
3. Dedicated test guild: create a new server and invite the bot, or designate an existing one. Test accounts for moderation and DMs.
4. Staffing: which agents write code, and whether isolated worktrees are allowed for this project.
5. First public release scope: bot-only phases 1 to 2, or wait for phase 3.
6. Voice media in scope for 1.0 or deferred.
7. Rollback: keep both current entries (`discord`, `discord-pasympa`) until cutover.
8. Budget, deadline and preferred parallelism.

Agents may draft designs and offline tests while these remain open, but must not invent credentials, recipients, permissions, publication authority or production deletion approval.

## 20. Non-goals

Undocumented or private Discord APIs; personal-account automation; bypassing permissions or application eligibility; running a hosted public service; treating downloaded content as instructions; owner- or client-specific workflow logic in the product; guaranteed knowledge of future API features.

## 21. Sources

- Discord OpenAPI specification (preview): https://github.com/discord/discord-api-spec
- API reference, uploading files and signed CDN URLs: https://docs.discord.com/developers/reference
- Message resource and attachments: https://docs.discord.com/developers/resources/message
- Change log: https://docs.discord.com/developers/change-log
- OAuth2: https://docs.discord.com/developers/topics/oauth2
- Gateway and intents: https://docs.discord.com/developers/events/gateway
- Rate limits: https://docs.discord.com/developers/topics/rate-limits
- MCP specification 2025-11-25: https://modelcontextprotocol.io/specification/2025-11-25
- MCP Registry: https://registry.modelcontextprotocol.io
- Candidates: https://github.com/PaSympa/discord-mcp, https://github.com/barryyip0625/mcp-discord, https://github.com/SaseQ/discord-mcp

PaSympa was inspected locally at commit `13302107125baa4c4da286ec182c927198c7ef11`; the published package tested earlier was 2.2.0. Their equivalence is not established. The 250-operation count comes from an unpinned 2 November 2026 extraction and is a starting artifact, not the baseline.

## Appendix A. Draft tool catalog

All names carry the `discord_` prefix. Variants of one action (guild or channel scope, ID or token, guild or application emoji) are merged into one tool with parameters. Operation counts match `discord-api-v10-operations.md`. Names and grouping may change after the spike; the register, not this table, measures coverage.

| Toolset | Tools | Ops | Credential | Phase | Default on |
| --- | --- | --- | --- | --- | --- |
| core | 8: get_current_user, update_current_user, get_user, list_my_guilds, leave_guild, get_application, update_application, get_gateway_info | 11 | bot | 1 | yes |
| messages | 15: list_messages, get_message, send_message, edit_message, delete_message, bulk_delete_messages, crosspost_message, search_messages, trigger_typing, list_pins, pin_message, unpin_message, get_poll_voters, end_poll, download_attachment | 17 | bot | 2 | yes |
| reactions | 4: add_reaction, remove_reaction, list_reaction_users, clear_reactions | 6 | bot | 2 | yes |
| threads | 10: create_thread, list_active_threads, list_archived_threads, search_threads, join_thread, leave_thread, list_thread_members, get_thread_member, add_thread_member, remove_thread_member | 13 | bot | 2 | yes |
| channels | 15: list_channels, get_channel, create_channel, update_channel, delete_channel, reorder_channels, follow_announcement_channel, set_permission_overwrite, delete_permission_overwrite, get_member_permissions, get_role_permissions, set_voice_channel_status, create_dm, add_group_dm_recipient, remove_group_dm_recipient | 17 | bot | 2 | yes |
| webhooks | 9: list_webhooks, create_webhook, get_webhook, update_webhook, delete_webhook, execute_webhook, get_webhook_message, update_webhook_message, delete_webhook_message | 18 | bot, webhook | 2 | yes |
| guild | 22: get_guild, update_guild, get_guild_preview, get_audit_log, list_integrations, delete_integration, update_incident_actions, get_vanity_url, get_welcome_screen, update_welcome_screen, get_onboarding, update_onboarding, get_new_member_welcome, get_widget_settings, update_widget_settings, get_widget, plus template list, get, create, sync, update, delete | 23 | bot | 3 | no |
| members | 12: list_members, search_members, get_member, add_member, update_member, update_current_member, remove_member, add_member_role, remove_member_role, prune_members, list_join_requests, act_on_join_request | 13 | bot (add_member needs user OAuth token) | 3 | no |
| roles | 7: list_roles, get_role, create_role, update_role, delete_role, reorder_roles, get_role_member_counts | 7 | bot | 3 | no |
| moderation | 10: list_bans, get_ban, ban_member, unban_member, bulk_ban, list_automod_rules, get_automod_rule, create_automod_rule, update_automod_rule, delete_automod_rule | 10 | bot | 3 | no |
| events | 10: list_events, get_event, create_event, update_event, delete_event, create_event_exception, update_event_exception, delete_event_exception, list_event_subscribers, count_event_subscribers | 11 | bot | 3 | no |
| invites | 9: list_invites, create_invite, get_invite, delete_invite, get_invite_target_users, set_invite_target_users, add_invite_target_users, remove_invite_target_users, get_invite_target_users_job | 12 | bot | 3 | no |
| expressions | 18: emoji list, get, create, update, delete (guild or application); list_stickers, get_sticker, create_sticker, update_sticker, delete_sticker, list_sticker_packs, get_sticker_pack; soundboard list, get, create, update, delete, send_soundboard_sound | 25 | bot | 3 | no |
| voice | 7: list_voice_regions, get_voice_state, update_voice_state, create_stage_instance, get_stage_instance, update_stage_instance, delete_stage_instance | 10 | bot | 3 | no |
| commands | 14: list_commands, get_command, create_command, update_command, delete_command, bulk_overwrite_commands, list_command_permissions, get_command_permissions, set_command_permissions, get_role_connection_metadata, update_role_connection_metadata, upload_application_attachment, get_activity_instance, create_interaction_response | 20 | app owner bot; set_command_permissions needs OAuth bearer | 4 | no |
| monetization | 7: list_entitlements, get_entitlement, create_test_entitlement, delete_test_entitlement, consume_entitlement, list_sku_subscriptions, get_sku_subscription | 7 | app with monetization | 4 | no |
| oauth_user | 10: get_oauth2_authorization, get_oauth2_application, list_my_connections, get_my_guild_member, get_user_role_connection, update_user_role_connection, delete_user_role_connection, list_my_entitlements, get_openid_userinfo, get_public_keys | 10 | user OAuth token | 4 | no |
| social_sdk | about 20, mapped 1:1: lobby (15) and Partner SDK (5) operations | 20 | Discord approval | 4 (lowest priority) | no |
| utility | get_server_status, get_coverage, discover_operations (optional) | 0 | none | 1 | yes |
| realtime | event subscription and read tools; design in phase 5 | n/a | bot with intents | 5 | no |

Totals: 207 HTTP-mapped tools covering 250 operations, plus utility and real-time tools. Default toolsets expose about 60 tools. Documented operations missing from the spec extraction (for example List SKUs) are added during phase 0.
