import { DiscordAPIError, HTTPError, RateLimitError, REST } from "@discordjs/rest";
import type {
  APIChannel,
  APIMessage,
  RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { Routes } from "discord-api-types/v10";
import { PToolError } from "../../core/tool-error.js";

export interface DiscordRest {
  getChannel(channelId: string): Promise<APIChannel>;
  getMessage(channelId: string, messageId: string): Promise<APIMessage>;
  listMessages(channelId: string, query: URLSearchParams): Promise<APIMessage[]>;
  sendMessage(
    channelId: string,
    body: RESTPostAPIChannelMessageJSONBody,
    files?: { name: string; data: Buffer }[],
  ): Promise<APIMessage>;
  editMessage(
    channelId: string,
    messageId: string,
    body: Record<string, unknown>,
    files?: { name: string; data: Buffer }[],
  ): Promise<APIMessage>;
}
export class PDiscordRestAdapter implements DiscordRest {
  private readonly rest: REST;
  constructor(token: string, rest = new REST({ version: "10", retries: 0 })) {
    this.rest = rest.setToken(token);
  }
  async getChannel(id: string) {
    return (await this.rest.get(Routes.channel(id))) as APIChannel;
  }
  async getMessage(channel: string, id: string) {
    return (await this.rest.get(Routes.channelMessage(channel, id))) as APIMessage;
  }
  async listMessages(channel: string, query: URLSearchParams) {
    return (await this.rest.get(Routes.channelMessages(channel), { query })) as APIMessage[];
  }
  async sendMessage(
    channel: string,
    body: RESTPostAPIChannelMessageJSONBody,
    files?: { name: string; data: Buffer }[],
  ) {
    return (await this.rest.post(Routes.channelMessages(channel), { body, files })) as APIMessage;
  }
  async editMessage(
    channel: string,
    id: string,
    body: Record<string, unknown>,
    files?: { name: string; data: Buffer }[],
  ) {
    return (await this.rest.patch(Routes.channelMessage(channel, id), {
      body,
      files,
    })) as APIMessage;
  }
}

export function toToolError(error: unknown, operationId: string): PToolError | undefined {
  if (error instanceof RateLimitError)
    return new PToolError("Discord rate limit exceeded", {
      category: "rate_limited",
      retryable: true,
      remediation: "Retry after the rate limit resets",
      operationId,
      retryAfter: error.retryAfter,
    });
  if (error instanceof DiscordAPIError || error instanceof HTTPError) {
    const status = error.status;
    const category =
      status === 403
        ? "permission"
        : status === 404
          ? "not_found"
          : status === 429
            ? "rate_limited"
            : "discord";
    return new PToolError(`Discord request failed (HTTP ${status})`, {
      category,
      retryable: status === 429 || status >= 500,
      remediation:
        status === 403 ? "Check the bot permissions" : "Check the request or retry later",
      operationId,
      status,
      discordCode: error instanceof DiscordAPIError ? error.code : undefined,
    });
  }
  return undefined;
}
