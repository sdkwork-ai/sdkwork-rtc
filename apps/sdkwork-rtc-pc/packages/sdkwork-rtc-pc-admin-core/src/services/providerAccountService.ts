import type { AuthTokenManager } from "@sdkwork/sdk-common";

import type { ProviderAccount, ProviderAccountCommand } from "../types/providerAccount";
import { newIdempotencyKey } from "../sdk/index.js";
import { resolveBackendRtcClient, type RtcBackendClientOptions, type RtcBackendClientSource } from "./backendClient";

interface ListResponse {
  items: ProviderAccount[];
  nextCursor?: string | null;
}

export class ProviderAccountService {
  private readonly client;

  constructor(
    baseUrlOrClient: RtcBackendClientSource,
    tokenManagerOrOptions?: AuthTokenManager | RtcBackendClientOptions,
  ) {
    this.client = resolveBackendRtcClient(baseUrlOrClient, tokenManagerOrOptions);
  }

  async list(params?: {
    provider?: string;
    status?: "active" | "disabled" | "archived";
    environment?: "development" | "test" | "staging" | "production" | "demo";
    page?: number;
    limit?: number;
    cursor?: string;
    search?: string;
    sort?: string;
  }): Promise<ListResponse> {
    const response = await this.client.rtcProviderAccounts.rtc.providerAccounts.list({
      provider: params?.provider,
      status: params?.status,
      environment: params?.environment,
      page: params?.page,
      pageSize: params?.limit,
      cursor: params?.cursor,
      q: params?.search,
      sort: params?.sort,
    });
    // The generated SDK unwraps the sdkwork-v3 envelope, so the response is
    // already the `data` payload ({ items, pageInfo }).
    const nextCursor = response.pageInfo?.nextCursor;
    return {
      items: response.items,
      nextCursor: nextCursor && nextCursor.length > 0 ? nextCursor : null,
    };
  }

  async get(id: string): Promise<ProviderAccount> {
    const response = await this.client.rtcProviderAccounts.rtc.providerAccounts.retrieve(id);
    if (!response) {
      throw new Error(`RTC provider account not found: ${id}`);
    }
    return response;
  }

  async create(command: ProviderAccountCommand): Promise<ProviderAccount> {
    const response = await this.client.rtcProviderAccounts.rtc.providerAccounts.create(
      command as Parameters<
        typeof this.client.rtcProviderAccounts.rtc.providerAccounts.create
      >[0],
      { idempotencyKey: newIdempotencyKey() },
    );
    if (!response) {
      throw new Error("Invalid response: missing provider account data");
    }
    return response;
  }

  async update(id: string, command: ProviderAccountCommand): Promise<ProviderAccount> {
    const response = await this.client.rtcProviderAccounts.rtc.providerAccounts.update(
      id,
      { idempotencyKey: newIdempotencyKey() },
      command as Parameters<
        typeof this.client.rtcProviderAccounts.rtc.providerAccounts.update
      >[2],
    );
    if (!response) {
      throw new Error("Invalid response: missing provider account data");
    }
    return response;
  }

  async disable(id: string, reason?: string): Promise<ProviderAccount> {
    const response = await this.client.rtcProviderAccounts.rtc.providerAccounts.disable(id, {
      reason,
    }, { idempotencyKey: newIdempotencyKey() });
    if (!response) {
      throw new Error("Invalid response: missing provider account data");
    }
    return response;
  }
}
