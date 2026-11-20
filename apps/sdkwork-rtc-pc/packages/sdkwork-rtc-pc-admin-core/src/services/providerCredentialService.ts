import type { AuthTokenManager } from "@sdkwork/sdk-common";

import type { ProviderCredential, ProviderCredentialCommand } from "../types/providerCredential";
import { newIdempotencyKey } from "../sdk/index.js";
import { resolveBackendRtcClient, type RtcBackendClientOptions, type RtcBackendClientSource } from "./backendClient";

interface ListResponse {
  items: ProviderCredential[];
  nextCursor?: string | null;
}

export class ProviderCredentialService {
  private readonly client;

  constructor(
    baseUrlOrClient: RtcBackendClientSource,
    tokenManagerOrOptions?: AuthTokenManager | RtcBackendClientOptions,
  ) {
    this.client = resolveBackendRtcClient(baseUrlOrClient, tokenManagerOrOptions);
  }

  async list(
    providerApplicationId: string,
    params?: {
      page?: number;
      limit?: number;
      cursor?: string;
      search?: string;
      sort?: string;
    },
  ): Promise<ListResponse> {
    const response =
      await this.client.rtcProviderCredentials.rtc.providerApplications.credentials.list(
        providerApplicationId,
        {
          page: params?.page,
          pageSize: params?.limit,
          cursor: params?.cursor,
          q: params?.search,
          sort: params?.sort,
        },
      );
    // The generated SDK unwraps the sdkwork-v3 envelope, so the response is
    // already the `data` payload ({ items, pageInfo }).
    const nextCursor = response.pageInfo?.nextCursor;
    return {
      items: response.items,
      nextCursor: nextCursor && nextCursor.length > 0 ? nextCursor : null,
    };
  }

  async get(id: string): Promise<ProviderCredential> {
    const response =
      await this.client.rtcProviderCredentials.rtc.providerCredentials.retrieve(id);
    if (!response) {
      throw new Error(`RTC provider credential not found: ${id}`);
    }
    return response;
  }

  async create(
    providerApplicationId: string,
    command: ProviderCredentialCommand,
  ): Promise<ProviderCredential> {
    const response =
      await this.client.rtcProviderCredentials.rtc.providerApplications.credentials.create(
        providerApplicationId,
        command as Parameters<
          typeof this.client.rtcProviderCredentials.rtc.providerApplications.credentials.create
        >[1],
        { idempotencyKey: newIdempotencyKey() },
      );
    if (!response) {
      throw new Error("Invalid response: missing provider credential data");
    }
    return response;
  }

  async update(id: string, command: ProviderCredentialCommand): Promise<ProviderCredential> {
    const response =
      await this.client.rtcProviderCredentials.rtc.providerCredentials.update(
        id,
        { idempotencyKey: newIdempotencyKey() },
        command as Parameters<
          typeof this.client.rtcProviderCredentials.rtc.providerCredentials.update
        >[2],
      );
    if (!response) {
      throw new Error("Invalid response: missing provider credential data");
    }
    return response;
  }

  async revoke(id: string, reason?: string): Promise<ProviderCredential> {
    const response = await this.client.rtcProviderCredentials.rtc.providerCredentials.revoke(id, {
      reason,
    }, { idempotencyKey: newIdempotencyKey() });
    if (!response) {
      throw new Error("Invalid response: missing provider credential data");
    }
    return response;
  }
}
