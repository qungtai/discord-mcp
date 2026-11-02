import type { DiscordRequest, ScopeKind, ScopeResolver } from "./ports.js";
import { PToolError } from "./tool-error.js";

// Each lookup returns the guild and channel a resource lives in.
const LOOKUPS: Partial<Record<ScopeKind, (id: string) => `/${string}`>> = {
  channel: (id) => `/channels/${id}`,
  webhook: (id) => `/webhooks/${id}`,
  invite: (id) => `/invites/${encodeURIComponent(id)}`,
};
interface Location {
  guild: string | null;
  channel?: string;
}
interface Found {
  guild_id?: string | null;
  channel_id?: string | null;
  guild?: { id: string };
  channel?: { id: string };
}

// Every channel, webhook and invite is resolved even when the input names a guild, so a guild ID
// cannot vouch for a resource in another guild. Resources never change guild, so lookups are cached.
export function createScopeResolver(): ScopeResolver {
  const cache = new Map<string, Promise<Location>>();
  const locate = (kind: ScopeKind, id: string, discord: DiscordRequest) => {
    const key = `${kind}:${id}`;
    let location = cache.get(key);
    if (!location) {
      const route = LOOKUPS[kind];
      if (!route) throw unchecked(kind);
      location = discord<Found>({ method: "GET", route: route(id) }).then((found) => ({
        guild: found.guild_id ?? found.guild?.id ?? null,
        channel: kind === "channel" ? id : (found.channel_id ?? found.channel?.id ?? undefined),
      }));
      location.catch(() => cache.delete(key));
      cache.set(key, location);
    }
    return location;
  };
  return async (ids, discord) => {
    // A message is checked by the channel in its route, so it needs a channel next to it.
    if (ids.message?.length && !ids.channel?.length) throw unchecked("message");
    const locations = await Promise.all(
      (Object.entries(ids) as [ScopeKind, string[]][])
        .filter(([kind]) => kind !== "guild" && kind !== "message")
        .flatMap(([kind, values]) => [...new Set(values)].map((id) => locate(kind, id, discord))),
    );
    const guilds = locations.map((l) => l.guild);
    return {
      guildIds: [...new Set([...(ids.guild ?? []), ...guilds.filter((g) => g !== null)])],
      channelIds: [...new Set(locations.flatMap((l) => (l.channel ? [l.channel] : [])))],
      isDm: guilds.includes(null),
    };
  };
}
function unchecked(kind: ScopeKind): PToolError {
  return new PToolError(`Scope kind ${kind} cannot be checked against the allowlist`, {
    category: "policy",
    retryable: false,
    remediation: "Unset DISCORD_MCP_ALLOWED_GUILDS to use this tool",
  });
}
