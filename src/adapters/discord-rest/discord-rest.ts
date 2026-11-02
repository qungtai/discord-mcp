import { REST } from "@discordjs/rest";
import type {
  APIChannel,
  APIMessage,
  RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { Routes } from "discord-api-types/v10";

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
  deleteMessage(channelId: string, messageId: string): Promise<void>;
}
export class PDiscordRestAdapter implements DiscordRest {
  private readonly rest: REST;
  constructor(token: string) {
    this.rest = new REST({ version: "10" }).setToken(token);
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
  async deleteMessage(channel: string, id: string) {
    await this.rest.delete(Routes.channelMessage(channel, id));
  }
}
