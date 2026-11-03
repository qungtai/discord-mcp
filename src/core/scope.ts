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
  isDm?: boolean;
}
interface Found {
  type?: number;
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
      location = discord<Found>({ method: "GET", route: route(id) }).then((found) => {
        const guild = found.guild_id ?? found.guild?.id ?? null;
        const channel =
          kind === "channel" ? id : (found.channel_id ?? found.channel?.id ?? undefined);
        const isDm =
          (kind === "channel" && (found.type === 1 || found.type === 3)) ||
          (kind === "invite" && found.type === 1);
        return {
          guild,
          channel,
          isDm,
        };
      });
      location.catch(() => cache.delete(key));
      cache.set(key, location);
    }
    return location;
  };
  return async (ids, discord) => {
    // A message is checked by the channel in its route, so it needs a channel next to it.
    if (ids.message?.length && !ids.channel?.length) throw unchecked("message");
    const userLocations: Location[] = (ids.user ?? []).map(() => ({ guild: null, isDm: true }));
    const locations = (
      await Promise.all(
        (Object.entries(ids) as [ScopeKind, string[]][])
          .filter(([kind]) => kind !== "guild" && kind !== "message" && kind !== "user")
          .flatMap(([kind, values]) => [...new Set(values)].map((id) => locate(kind, id, discord))),
      )
    ).concat(userLocations);
    const guilds = locations.map((l) => l.guild);
    return {
      guildIds: [...new Set([...(ids.guild ?? []), ...guilds.filter((g) => g !== null)])],
      channelIds: [...new Set(locations.flatMap((l) => (l.channel ? [l.channel] : [])))],
      isDm: locations.some((l) => l.isDm),
      noGuild: locations.some((l) => l.guild === null && !l.isDm),
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
