import { AllowedMentionsTypes } from "discord-api-types/v10";
import { z } from "zod";
import type { DiscordRest } from "../../adapters/discord-rest/discord-rest.js";
import type { PAttachmentService } from "../../adapters/files/attachment-service.js";
import { defineTool, type PToolRegistry } from "../../core/tool-registry.js";

const id = z.string().regex(/^\d+$/);
const file = z.object({
  path: z.string(),
  filename: z.string().optional(),
  description: z.string().optional(),
  spoiler: z.boolean().optional(),
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

export function registerMessageTools(
  registry: PToolRegistry,
  rest: DiscordRest,
  attachments: PAttachmentService,
): void {
  const add = (
    name: string,
    description: string,
    input: z.AnyZodObject,
    mutating: boolean,
    handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ) =>
    registry.register(
      defineTool({
        name,
        description,
        input,
        output: result,
        toolset: "messages",
        mutating,
        annotations: {
          readOnlyHint: !mutating,
          destructiveHint: name === "discord_delete_message",
          idempotentHint: !mutating,
          openWorldHint: true,
        },
        handler,
      }),
    );
  const uploads = async (files: z.infer<typeof file>[]) =>
    Promise.all(
      files.map(async (f) => {
        const uploaded = await attachments.upload(f.path, f.filename);
        return {
          ...uploaded,
          name:
            f.spoiler && !uploaded.name.startsWith("SPOILER_")
              ? `SPOILER_${uploaded.name}`
              : uploaded.name,
        };
      }),
    );
  add(
    "discord_send_message",
    "Send a message",
    z.object({
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
    true,
    async (raw) => {
      const p = z
        .object({
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
          files: z.array(file),
        })
        .parse(raw);
      const files = await uploads(p.files);
      return {
        result: await rest.sendMessage(
          p.channel_id,
          {
            content: p.content,
            embeds: p.embeds,
            allowed_mentions: p.allowed_mentions ?? { parse: [] },
            message_reference: p.message_reference,
            attachments: files.map((f, i) => ({
              id: i.toString(),
              filename: f.name,
              description: p.files[i]?.description,
            })),
          },
          files,
        ),
      };
    },
  );
  add(
    "discord_edit_message",
    "Edit a message and its attachments",
    z.object({
      ...message,
      ...body,
      add_files: z.array(file).optional(),
      remove_attachment_ids: z.array(id).optional(),
      update_attachments: z.array(update).optional(),
    }),
    true,
    async (raw) => {
      const p = z
        .object({
          ...message,
          ...body,
          add_files: z.array(file).optional(),
          remove_attachment_ids: z.array(id).optional(),
          update_attachments: z.array(update).optional(),
        })
        .parse(raw);
      if (p.remove_attachment_ids?.length)
        throw new Error("Attachment removal requires approval support");
      const files = await uploads(p.add_files ?? []);
      const payload: Record<string, unknown> = { content: p.content, embeds: p.embeds };
      if (p.add_files || p.remove_attachment_ids || p.update_attachments) {
        const existing = await rest.getMessage(p.channel_id, p.message_id);
        const existingIds = new Set(existing.attachments.map((a) => a.id));
        for (const item of [
          ...(p.remove_attachment_ids ?? []),
          ...(p.update_attachments ?? []).map((a) => a.id),
        ])
          if (!existingIds.has(item)) throw new Error("Unknown attachment");
        payload.attachments = [
          ...existing.attachments
            .filter((a) => !p.remove_attachment_ids?.includes(a.id))
            .map((a) => {
              const change = p.update_attachments?.find((u) => u.id === a.id);
              let filename = a.filename;
              if (change?.is_spoiler === true && !filename.startsWith("SPOILER_"))
                filename = `SPOILER_${filename}`;
              if (change?.is_spoiler === false && filename.startsWith("SPOILER_"))
                filename = filename.slice(8);
              return { id: a.id, filename, description: change?.description ?? a.description };
            }),
          ...files.map((f, i) => ({
            id: i.toString(),
            filename: f.name,
            description: p.add_files?.[i]?.description,
          })),
        ];
      }
      return { result: await rest.editMessage(p.channel_id, p.message_id, payload, files) };
    },
  );
  add("discord_get_message", "Get a message", z.object(message), false, async (r) => {
    const p = z.object(message).parse(r);
    return { result: await rest.getMessage(p.channel_id, p.message_id) };
  });
  add(
    "discord_list_messages",
    "List messages",
    z.object({
      ...channel,
      limit: z.number().int().min(1).max(100).optional(),
      before: id.optional(),
      after: id.optional(),
      around: id.optional(),
    }),
    false,
    async (r) => {
      const p = z
        .object({
          ...channel,
          limit: z.number().optional(),
          before: id.optional(),
          after: id.optional(),
          around: id.optional(),
        })
        .parse(r);
      const q = new URLSearchParams();
      for (const key of ["limit", "before", "after", "around"] as const)
        if (p[key] !== undefined) q.set(key, String(p[key]));
      return { result: await rest.listMessages(p.channel_id, q) };
    },
  );
  add(
    "discord_download_attachment",
    "Download a message attachment",
    z.object({ ...message, attachment_id: id }),
    false,
    async (r) => {
      const p = z.object({ ...message, attachment_id: id }).parse(r);
      const msg = await rest.getMessage(p.channel_id, p.message_id);
      const attachment = msg.attachments.find((a) => a.id === p.attachment_id);
      if (!attachment) throw new Error("Attachment not found");
      return { result: await attachments.download(attachment.url, attachment.filename) };
    },
  );
}
