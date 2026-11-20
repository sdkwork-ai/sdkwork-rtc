import {resolveBaseUrlWithAlignProtocol} from "@sdkwork/sdk-common";

export interface RtcEnvironment {
  apiBaseUrl: string;
  appbaseAppApiBaseUrl: string;
  backendApiBaseUrl: string;
  appbaseLoginUrl: string;
  defaultMediaMode: "audio" | "video" | "live";
  providerSelection: string;
}

// Topology surface keys (docs/topology-standard.md): the deployment
// materialization writes the per-application `VITE_SDKWORK_RTC_PC_*` keys into
// the build environment from the profile env. The shared
// `SDKWORK_API_BASE_URL` stays as the local-development fallback so existing
// dev flows keep working without a materialized profile.
const APPLICATION_PUBLIC_HTTP_URL_ENV_KEY = "VITE_SDKWORK_RTC_PC_APPLICATION_PUBLIC_HTTP_URL";
const APP_API_BASE_URL_ENV_KEY = "VITE_SDKWORK_RTC_PC_APP_API_BASE_URL";
const APPBASE_APP_API_BASE_URL_ENV_KEY = "VITE_SDKWORK_RTC_PC_APPBASE_APP_API_BASE_URL";
const BACKEND_API_BASE_URL_ENV_KEY = "VITE_SDKWORK_RTC_PC_BACKEND_API_BASE_URL";
const APPBASE_LOGIN_URL_ENV_KEY = "VITE_SDKWORK_RTC_PC_APPBASE_LOGIN_URL";
const SHARED_API_BASE_URL_ENV_KEY = "SDKWORK_API_BASE_URL";

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function deriveBackendApiBaseUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/+$/u, "")}/backend/v3/api`;
}

function resolveFirstBaseUrl(keys: readonly string[], preservePath = false): string | undefined {
  for (const key of keys) {
    const raw = String(import.meta.env[key] ?? "").trim();
    if (!raw) continue;
    return resolveBaseUrlWithAlignProtocol({ envKey: key, preservePath }).url;
  }
  return undefined;
}

export function resolveEnvironment(): RtcEnvironment {
  // Per-surface topology keys win, the appbase alias is the second source, and
  // the shared local-dev key is the final fallback. `preservePath` keeps an
  // `/app/v3/api` path when the resolved key carries one; the backend surface
  // derives its own `/backend/v3/api` path from the application origin.
  const appApiBaseUrl = normalizeBaseUrl(
    resolveFirstBaseUrl([APP_API_BASE_URL_ENV_KEY, APPBASE_APP_API_BASE_URL_ENV_KEY], true),
    resolveBaseUrlWithAlignProtocol({
      envKey: SHARED_API_BASE_URL_ENV_KEY,
      preservePath: true,
    }).url,
  );
  const apiOrigin = normalizeBaseUrl(
    resolveFirstBaseUrl([APPLICATION_PUBLIC_HTTP_URL_ENV_KEY]),
    resolveBaseUrlWithAlignProtocol({ envKey: SHARED_API_BASE_URL_ENV_KEY }).url,
  );

  return {
    apiBaseUrl: appApiBaseUrl,
    appbaseAppApiBaseUrl: normalizeBaseUrl(
      resolveFirstBaseUrl([APPBASE_APP_API_BASE_URL_ENV_KEY], true),
      appApiBaseUrl,
    ),
    backendApiBaseUrl: normalizeBaseUrl(
      resolveFirstBaseUrl([BACKEND_API_BASE_URL_ENV_KEY]),
      deriveBackendApiBaseUrl(apiOrigin),
    ),
    appbaseLoginUrl: normalizeBaseUrl(
      resolveFirstBaseUrl([APPBASE_LOGIN_URL_ENV_KEY]),
      resolveBaseUrlWithAlignProtocol().url,
    ),
    defaultMediaMode: "video",
    providerSelection: "auto",
  };
}
