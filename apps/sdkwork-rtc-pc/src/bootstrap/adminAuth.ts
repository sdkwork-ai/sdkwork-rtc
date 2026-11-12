import { readBootstrapAccessTokenFromProcessEnv } from '@sdkwork/iam-credential-entry';
import {
  createTokenManager as createSdkworkTokenManager,
  type AuthTokenManager,
} from "@sdkwork/sdk-common";

import { setTokenManager } from "./tokenManager";
import {
  loadAdminSession,
  type RtcAdminSession,
} from "./adminSessionStorage";

export {
  DEFAULT_ADMIN_SESSION,
  RTC_ADMIN_SESSION_STORAGE_KEY,
  clearAdminSession,
  loadAdminSession,
  saveAdminSession,
} from "./adminSessionStorage";
export type { RtcAdminSession } from "./adminSessionStorage";

export const DEFAULT_ADMIN_PERMISSION_SCOPE = "rtc.*";

export function buildAdminSdkHeaders(session: RtcAdminSession): Record<string, string> {
  return {
    "x-sdkwork-tenant-id": session.tenantId,
    "x-sdkwork-organization-id": session.organizationId,
    "x-sdkwork-user-id": session.userId,
    "x-sdkwork-actor-id": session.userId,
    "x-sdkwork-permission-scope": DEFAULT_ADMIN_PERMISSION_SCOPE,
  };
}

export function createAdminTokenManager(session: RtcAdminSession): AuthTokenManager {
  const manager = createSdkworkTokenManager();
  // Fall back to the private bootstrap Access-Token artifact when no interactive
  // admin session exists (APP_SDK_INTEGRATION_SPEC section 4).
  manager.setTokens?.({
    accessToken: session.accessToken ?? readBootstrapAccessTokenFromProcessEnv(),
    authToken: session.authToken,
  });
  return manager;
}

export function bootstrapAdminAuth(): RtcAdminSession | null {
  const session = loadAdminSession();
  if (!session) {
    return null;
  }
  setTokenManager(createAdminTokenManager(session));
  return session;
}
