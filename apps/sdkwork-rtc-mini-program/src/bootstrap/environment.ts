import {resolveBaseUrlWithAlignProtocol, splitBaseUrls} from "@sdkwork/sdk-common";

export interface RtcEnvironment {
  apiBaseUrl: string;
  appbaseLoginUrl: string;
  defaultMediaMode: "audio" | "video" | "live";
}

declare const __SDKWORK_RTC_DEFAULT_API_BASE_URL__: string | undefined;
declare const __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__: string | undefined;

const RUNTIME_CONFIG_KEY = "sdkwork.rtc.runtime.config";
const DEFAULT_MEDIA_MODE = "video";

function readInjectedDefault(value: string | undefined): string {
  const [injected = ""] = splitBaseUrls(String(value ?? "").trim());
  return injected;
}

function resolveDefaultApiBaseUrl(): string {
  // The build-time injected profile value wins; otherwise the shared
  // SDKWORK_API_BASE_URL is resolved. `preservePath` keeps the `/app/v3/api`
  // path configured through that key.
  return (
    readInjectedDefault(
      typeof __SDKWORK_RTC_DEFAULT_API_BASE_URL__ === "string"
        ? __SDKWORK_RTC_DEFAULT_API_BASE_URL__
        : undefined,
    ) || resolveBaseUrlWithAlignProtocol({ preservePath: true }).url
  );
}

function resolveDefaultAppbaseLoginUrl(): string {
  return (
    readInjectedDefault(
      typeof __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__ === "string"
        ? __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__
        : undefined,
    ) || resolveBaseUrlWithAlignProtocol().url
  );
}

function normalizeBaseUrl(value: string | undefined, fallback: () => string): string {
  // Mini programs have no browser location, so the base url is injected by the
  // host. A comma/semicolon separated list of candidates is accepted and the
  // first one wins.
  const [normalized] = splitBaseUrls(String(value ?? "").trim());
  return normalized || fallback();
}

function readStoredRuntimeConfig(): Partial<RtcEnvironment> {
  try {
    const wxStorage = (globalThis as { wx?: { getStorageSync(key: string): unknown } }).wx;
    const raw = wxStorage?.getStorageSync?.(RUNTIME_CONFIG_KEY);
    if (raw && typeof raw === "object") {
      return raw as Partial<RtcEnvironment>;
    }
    if (typeof raw === "string" && raw.trim()) {
      return JSON.parse(raw) as Partial<RtcEnvironment>;
    }
  } catch {
    return {};
  }
  return {};
}

export function resolveEnvironment(): RtcEnvironment {
  const stored = readStoredRuntimeConfig();
  return {
    apiBaseUrl: normalizeBaseUrl(stored.apiBaseUrl, resolveDefaultApiBaseUrl),
    appbaseLoginUrl: normalizeBaseUrl(
      stored.appbaseLoginUrl,
      resolveDefaultAppbaseLoginUrl,
    ),
    defaultMediaMode: stored.defaultMediaMode ?? DEFAULT_MEDIA_MODE,
  };
}

export function saveRuntimeEnvironment(config: Partial<RtcEnvironment>): RtcEnvironment {
  const next: RtcEnvironment = {
    ...resolveEnvironment(),
    ...config,
  };
  if (config.apiBaseUrl !== undefined) {
    next.apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl, resolveDefaultApiBaseUrl);
  }
  const wxStorage = (globalThis as { wx?: { setStorageSync(key: string, value: unknown): void } }).wx;
  wxStorage?.setStorageSync?.(RUNTIME_CONFIG_KEY, next);
  return next;
}
