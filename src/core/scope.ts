import type { ScopeResolver } from "./ports.js";

// Every channel is resolved even when the input names a guild, so a guild ID cannot vouch for a
// channel in another guild. A channel never changes guild, so lookups are cached per resolver.
export function createScopeResolver(): ScopeResolver {
  const guildOf = new Map<string, string | null>();
  return async (ids, discord) => {
    const channelIds = ids.channel ?? [];
    const channelGuilds = await Promise.all(
      channelIds.map(async (id) => {
        const cached = guildOf.get(id);
        if (cached !== undefined) return cached;
        const channel = await discord<{ guild_id?: string }>({
          method: "GET",
          route: `/channels/${id}`,
        });
        guildOf.set(id, channel.guild_id ?? null);
        return channel.guild_id ?? null;
      }),
    );
    const guildIds = [
      ...new Set([...(ids.guild ?? []), ...channelGuilds.filter((g) => g !== null)]),
    ];
    return { guildIds, channelIds, isDm: channelGuilds.includes(null) };
  };
}
