import type { AuthTokenManager } from "@sdkwork/sdk-common";

import type { ProviderRoute, ProviderRouteCommand } from "../types/providerRoute";
import { newIdempotencyKey } from "../sdk/index.js";
import { resolveBackendRtcClient, type RtcBackendClientOptions, type RtcBackendClientSource } from "./backendClient";

interface ListResponse {
  items: ProviderRoute[];
  nextCursor?: string | null;
}

export class ProviderRouteService {
  private readonly client;

  constructor(
    baseUrlOrClient: RtcBackendClientSource,
    tokenManagerOrOptions?: AuthTokenManager | RtcBackendClientOptions,
  ) {
    this.client = resolveBackendRtcClient(baseUrlOrClient, tokenManagerOrOptions);
  }

  async list(params?: {
    page?: number;
    limit?: number;
    cursor?: string;
    search?: string;
    sort?: string;
  }): Promise<ListResponse> {
    const response = await this.client.rtcProviderRoutes.rtc.providerRoutes.list({
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

  async create(command: ProviderRouteCommand): Promise<ProviderRoute> {
    const response = await this.client.rtcProviderRoutes.rtc.providerRoutes.create(
      command as Parameters<
        typeof this.client.rtcProviderRoutes.rtc.providerRoutes.create
      >[0],
    { idempotencyKey: newIdempotencyKey() });
    if (!response) {
      throw new Error("Invalid response: missing provider route data");
    }
    return response;
  }

  async get(id: string): Promise<ProviderRoute> {
    const response = await this.client.rtcProviderRoutes.rtc.providerRoutes.retrieve(id);
    if (!response) {
      throw new Error(`RTC provider route not found: ${id}`);
    }
    return response;
  }

  async update(id: string, command: ProviderRouteCommand): Promise<ProviderRoute> {
    const response = await this.client.rtcProviderRoutes.rtc.providerRoutes.update(
      id,
      { idempotencyKey: newIdempotencyKey() },
      command as Parameters<
        typeof this.client.rtcProviderRoutes.rtc.providerRoutes.update
      >[2],
    );
    if (!response) {
      throw new Error("Invalid response: missing provider route data");
    }
    return response;
  }

  async activate(id: string): Promise<ProviderRoute> {
    const response = await this.client.rtcProviderRoutes.rtc.providerRoutes.activate(
      id,
      { idempotencyKey: newIdempotencyKey() },
    );
    if (!response) {
      throw new Error("Invalid response: missing data");
    }
    return response;
  }
  async disable(id: string, reason?: string): Promise<ProviderRoute> {
    const response = await this.client.rtcProviderRoutes.rtc.providerRoutes.disable(id, {
      reason,
    }, { idempotencyKey: newIdempotencyKey() });
    if (!response) {
      throw new Error("Invalid response: missing provider route data");
    }
    return response;
  }
}
