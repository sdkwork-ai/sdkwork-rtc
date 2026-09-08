import { splitBaseUrls } from "@sdkwork/sdk-common";

export interface RtcEnvironment {
  apiBaseUrl: string;
  appbaseLoginUrl: string;
  defaultMediaMode: "audio" | "video" | "live";
}

declare const __SDKWORK_RTC_DEFAULT_API_BASE_URL__: string | undefined;
declare const __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__: string | undefined;

const RUNTIME_CONFIG_KEY = "sdkwork.rtc.runtime.config";

const defaultEnvironment: RtcEnvironment = {
  apiBaseUrl:
    typeof __SDKWORK_RTC_DEFAULT_API_BASE_URL__ === "string" &&
    __SDKWORK_RTC_DEFAULT_API_BASE_URL__.length > 0
      ? __SDKWORK_RTC_DEFAULT_API_BASE_URL__
      : "",
  appbaseLoginUrl:
    typeof __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__ === "string" &&
    __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__.length > 0
      ? __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__
      : "",
  defaultMediaMode: "video",
};

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  // Mini programs have no `window.location`, so the base url is injected by the
  // host. A comma/semicolon separated list of candidates is accepted and the
  // first one wins.
  const [normalized] = splitBaseUrls(String(value ?? "").trim());
  return normalized || fallback;
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
    apiBaseUrl: normalizeBaseUrl(stored.apiBaseUrl, defaultEnvironment.apiBaseUrl),
    appbaseLoginUrl: normalizeBaseUrl(stored.appbaseLoginUrl, defaultEnvironment.appbaseLoginUrl),
    defaultMediaMode: stored.defaultMediaMode ?? defaultEnvironment.defaultMediaMode,
  };
}

export function saveRuntimeEnvironment(config: Partial<RtcEnvironment>): RtcEnvironment {
  const next: RtcEnvironment = {
    ...resolveEnvironment(),
    ...config,
  };
  if (config.apiBaseUrl !== undefined) {
    next.apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl, defaultEnvironment.apiBaseUrl);
  }
  const wxStorage = (globalThis as { wx?: { setStorageSync(key: string, value: unknown): void } }).wx;
  wxStorage?.setStorageSync?.(RUNTIME_CONFIG_KEY, next);
  return next;
}
