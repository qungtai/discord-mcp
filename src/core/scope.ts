import type { ScopeResolver } from "./ports.js";

export const resolveScope: ScopeResolver = async (ids, discord) => {
  const channelIds = ids.channel ?? [];
  if (ids.guild?.length) return { guildIds: ids.guild, channelIds, isDm: false };
  const channels = await Promise.all(
    channelIds.map((id) =>
      discord<{ guild_id?: string }>({ method: "GET", route: `/channels/${id}` }),
    ),
  );
  const guildIds = [...new Set(channels.flatMap((c) => (c.guild_id ? [c.guild_id] : [])))];
  return { guildIds, channelIds, isDm: channels.some((c) => !c.guild_id) };
};
