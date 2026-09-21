import { readBootstrapAccessTokenFromProcessEnv } from '@sdkwork/iam-credential-entry';
import {
  createTokenManager as createSdkTokenManager,
  type AuthTokenManager,
} from "@sdkwork/sdk-common";

let activeTokenManager: AuthTokenManager | undefined;

export function setTokenManager(tokenManager: AuthTokenManager): void {
  activeTokenManager = tokenManager;
}

export function getTokenManager(): AuthTokenManager | undefined {
  return activeTokenManager;
}

/**
 * Create the renderer TokenManager, seeded with the private bootstrap
 * Access-Token artifact when one is present
 * (`APP_SDK_INTEGRATION_SPEC.md` section 4). Generated SDK transports read
 * `Access-Token` exclusively from `getAccessToken()` and fail before dispatch
 * when it is empty, so an unseeded manager would make every protected surface
 * unusable before the first appbase login.
 */
export function createTokenManager(): AuthTokenManager {
  const manager = createSdkTokenManager();
  const bootstrapAccessToken = readBootstrapAccessTokenFromProcessEnv();
  if (bootstrapAccessToken) {
    manager.setTokens({ accessToken: bootstrapAccessToken });
  }
  return manager;
}

export type { AuthTokenManager };
