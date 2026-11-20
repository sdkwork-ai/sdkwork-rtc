import type { AuthTokenManager, AuthTokens } from "@sdkwork/sdk-common";

export type { AuthTokenManager, AuthTokens };

let activeTokenManager: AuthTokenManager | undefined;

export function setTokenManager(tokenManager: AuthTokenManager): void {
  activeTokenManager = tokenManager;
}

export function getTokenManager(): AuthTokenManager | undefined {
  return activeTokenManager;
}

interface StoredTokens {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

function isExpiredTokens(tokens: StoredTokens): boolean {
  return typeof tokens.expiresAt === "number" && tokens.expiresAt <= Date.now();
}

export function createTokenManager(getAccessToken: () => string | undefined): AuthTokenManager {
  let tokens: StoredTokens = {};
  const readAccessToken = () => tokens.accessToken ?? getAccessToken();
  const hasToken = () => Boolean(readAccessToken() || tokens.authToken);
  return {
    getAccessToken: readAccessToken,
    getAuthToken: () => tokens.authToken,
    getRefreshToken: () => tokens.refreshToken,
    getTokens: () => ({ ...tokens }),
    setTokens(next: AuthTokens) {
      tokens = {
        accessToken: next.accessToken,
        authToken: next.authToken,
        refreshToken: next.refreshToken,
        expiresAt: next.expiresAt,
      };
    },
    setAccessToken(token: string) {
      tokens.accessToken = token;
    },
    setAuthToken(token: string) {
      tokens.authToken = token;
    },
    setRefreshToken(token: string) {
      tokens.refreshToken = token;
    },
    clearTokens() {
      tokens = {};
    },
    clearAuthToken() {
      tokens.authToken = undefined;
    },
    clearAccessToken() {
      tokens.accessToken = undefined;
    },
    isExpired: () => isExpiredTokens(tokens),
    isValid: () => hasToken() && !isExpiredTokens(tokens),
    hasToken,
    hasAuthToken: () => Boolean(tokens.authToken),
    hasAccessToken: () => Boolean(readAccessToken()),
    willExpireIn: (seconds: number) => {
      if (typeof tokens.expiresAt !== "number") {
        return false;
      }
      return tokens.expiresAt - Date.now() <= seconds * 1000;
    },
  };
}
