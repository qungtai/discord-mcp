import { randomBytes } from "node:crypto";
import { AllowedMentionsTypes } from "discord-api-types/v10";
import { z } from "zod";
import { toToolError } from "../../adapters/discord-rest/discord-rest.js";
import { PToolError } from "../../core/tool-error.js";
import { defineTool, type PToolRegistry, type ToolContext } from "../../core/tool-registry.js";

const id = z.string().regex(/^\d+$/);
const file = z.object({
  path: z.string(),
  filename: z.string().optional(),
  description: z.string().optional(),
  is_spoiler: z.boolean().optional(),
  title: z.string().optional(),
  content_type: z.string().optional(),
});
const update = z.object({
  id,
  description: z.string().optional(),
  is_spoiler: z.boolean().optional(),
});
const channel = { channel_id: id };
const message = { ...channel, message_id: id };
const body = { content: z.string().optional(), embeds: z.array(z.record(z.unknown())).optional() };
const result = z.object({ result: z.unknown() });

export function registerMessageTools(registry: PToolRegistry): void {
  const uploads = async (files: z.infer<typeof file>[], attachments: ToolContext["files"]) =>
    Promise.all(
      files.map(async (f) => {
        const uploaded = await attachments.upload(f.path, f.filename);
        return { ...uploaded, contentType: f.content_type };
      }),
    );
  registry.register(
    defineTool({
      name: "discord_send_message",
      description: "Send a message",
      operation_ids: ["create_message"],
      toolset: "messages",
      credential: "bot",
      scope: { kind: "channel", param: "channel_id" },
      effect: "write",
      idempotent: false,
      output: result,
      input: z.object({
        ...channel,
        ...body,
        allowed_mentions: z
          .object({
            parse: z.array(z.nativeEnum(AllowedMentionsTypes)).optional(),
            roles: z.array(id).optional(),
            users: z.array(id).optional(),
            replied_user: z.boolean().optional(),
          })
          .optional(),
        message_reference: z
          .object({
            message_id: id,
            channel_id: id.optional(),
            guild_id: id.optional(),
            fail_if_not_exists: z.boolean().optional(),
          })
          .optional(),
        files: z.array(file).default([]),
      }),
      execute: async (p, { rest, files: attachments }) => {
        const files = await uploads(p.files, attachments);
        const nonce = randomBytes(12).toString("hex");
        try {
          return {
            result: await rest.sendMessage(
              p.channel_id,
              {
                nonce,
                enforce_nonce: true,
                content: p.content,
                embeds: p.embeds,
                allowed_mentions: p.allowed_mentions ?? { parse: [] },
                message_reference: p.message_reference,
                attachments: files.map((f, i) => ({
                  id: i.toString(),
                  filename: f.name,
                  description: p.files[i]?.description,
                  title: p.files[i]?.title,
                  is_spoiler: p.files[i]?.is_spoiler,
                })),
              },
              files,
            ),
          };
        } catch (error) {
          const mapped = toToolError(error, "discord_send_message");
          if (mapped && (mapped.status === undefined || mapped.status < 500)) throw mapped;
          throw new PToolError("Message delivery is uncertain", {
            category: "uncertain",
            retryable: false,
            remediation: "Check the channel before sending again",
            resourceIds: { channel_id: p.channel_id, nonce },
            cause: error,
          });
        }
      },
    }),
  );
  registry.register(
    defineTool({
      name: "discord_edit_message",
      description: "Edit a message and its attachments",
      operation_ids: ["get_message", "update_message"],
      toolset: "messages",
      credential: "bot",
      scope: { kind: "channel", param: "channel_id" },
      effect: "destructive",
      idempotent: false,
      output: result,
      input: z.object({
        ...message,
        ...body,
        add_files: z.array(file).optional(),
        remove_attachment_ids: z.array(id).optional(),
        update_attachments: z.array(update).optional(),
      }),
      execute: async (p, { rest, files: attachments }) => {
        if (p.remove_attachment_ids?.length)
          throw new PToolError("Attachment removal requires approval support", {
            category: "policy",
            retryable: false,
            remediation: "Use approval when supported",
          });
        const payload: Record<string, unknown> = { content: p.content, embeds: p.embeds };
        if (p.add_files || p.remove_attachment_ids || p.update_attachments) {
          const existing = await rest.getMessage(p.channel_id, p.message_id);
          const existingIds = new Set(existing.attachments.map((a) => a.id));
          for (const item of [
            ...(p.remove_attachment_ids ?? []),
            ...(p.update_attachments ?? []).map((a) => a.id),
          ])
            if (!existingIds.has(item))
              throw new PToolError("Unknown attachment", {
                category: "not_found",
                retryable: false,
                remediation: "Choose an existing attachment",
              });
          payload.attachments = [
            ...existing.attachments
              .filter((a) => !p.remove_attachment_ids?.includes(a.id))
              .map((a) => {
                const change = p.update_attachments?.find((u) => u.id === a.id);
                return {
                  id: a.id,
                  description: change?.description ?? a.description,
                  is_spoiler: change?.is_spoiler,
                };
              }),
          ];
        }
        const files = await uploads(p.add_files ?? [], attachments);
        if (Array.isArray(payload.attachments))
          payload.attachments.push(
            ...files.map((f, i) => ({
              id: i.toString(),
              filename: f.name,
              description: p.add_files?.[i]?.description,
              title: p.add_files?.[i]?.title,
              is_spoiler: p.add_files?.[i]?.is_spoiler,
            })),
          );
        return { result: await rest.editMessage(p.channel_id, p.message_id, payload, files) };
      },
    }),
  );
  registry.register(
    defineTool({
      name: "discord_get_message",
      description: "Get a message",
      operation_ids: ["get_message"],
      toolset: "messages",
      credential: "bot",
      scope: { kind: "channel", param: "channel_id" },
      effect: "read",
      idempotent: true,
      output: result,
      input: z.object(message),
      execute: async (p, { rest }) => {
        return { result: await rest.getMessage(p.channel_id, p.message_id) };
      },
    }),
  );
  registry.register(
    defineTool({
      name: "discord_list_messages",
      description: "List messages",
      operation_ids: ["list_messages"],
      toolset: "messages",
      credential: "bot",
      scope: { kind: "channel", param: "channel_id" },
      effect: "read",
      idempotent: true,
      output: result,
      input: z.object({
        ...channel,
        limit: z.number().int().min(1).max(100).optional(),
        before: id.optional(),
        after: id.optional(),
        around: id.optional(),
      }),
      execute: async (p, { rest }) => {
        const q = new URLSearchParams();
        for (const key of ["limit", "before", "after", "around"] as const)
          if (p[key] !== undefined) q.set(key, String(p[key]));
        return { result: await rest.listMessages(p.channel_id, q) };
      },
    }),
  );
  registry.register(
    defineTool({
      name: "discord_download_attachment",
      description: "Download a message attachment",
      operation_ids: ["get_message"],
      toolset: "messages",
      credential: "bot",
      scope: { kind: "channel", param: "channel_id" },
      effect: "local_write",
      idempotent: false,
      output: result,
      input: z.object({ ...message, attachment_id: id }),
      execute: async (p, { rest, files: attachments }) => {
        const msg = await rest.getMessage(p.channel_id, p.message_id);
        const attachment = msg.attachments.find((a) => a.id === p.attachment_id);
        if (!attachment)
          throw new PToolError("Attachment not found", {
            category: "not_found",
            retryable: false,
            remediation: "Choose an existing attachment",
          });
        return { result: await attachments.download(attachment.url, attachment.filename) };
      },
    }),
  );
}
