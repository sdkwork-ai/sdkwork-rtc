/**
 * RTC admin session persistence.
 *
 * The admin console signs in with a manually pasted backend dual-token pair.
 * That credential used to be persisted in `localStorage`, so the next account
 * on the same browser/Electron profile opened the admin console as the previous
 * administrator. It now lives in `sessionStorage` only (this tab, gone when the
 * tab closes) and is cleared whenever the user session ends.
 *
 * This module intentionally has no imports so the storage behaviour can be
 * exercised without the app's SDK graph.
 */

export interface RtcAdminSession {
  accessToken: string;
  authToken: string;
  tenantId: string;
  organizationId: string;
  userId: string;
}

export const RTC_ADMIN_SESSION_STORAGE_KEY = "sdkwork-rtc-pc:admin-session:v1";

/** Key used by the pre-fix local-migration builds. */
export const LEGACY_RTC_ADMIN_SESSION_STORAGE_KEY = "sdkwork.rtc.admin.session";

export const DEFAULT_ADMIN_SESSION: RtcAdminSession = {
  accessToken: "",
  authToken: "",
  tenantId: "100001",
  organizationId: "default",
  userId: "1",
};

function getSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Drops admin tokens written to `localStorage` by pre-fix builds instead of
 * restoring them: an administrator re-authenticates once after the upgrade.
 */
function discardLegacyPersistedAdminSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(RTC_ADMIN_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_RTC_ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Restricted context: nothing persisted to remove.
  }
}

function parseStoredAdminSession(raw: string): RtcAdminSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RtcAdminSession>;
    if (!parsed.accessToken?.trim()) {
      return null;
    }
    return {
      accessToken: parsed.accessToken.trim(),
      authToken: parsed.authToken?.trim() || parsed.accessToken.trim(),
      tenantId: parsed.tenantId?.trim() || DEFAULT_ADMIN_SESSION.tenantId,
      organizationId: parsed.organizationId?.trim() || DEFAULT_ADMIN_SESSION.organizationId,
      userId: parsed.userId?.trim() || DEFAULT_ADMIN_SESSION.userId,
    };
  } catch {
    return null;
  }
}

function migrateLegacyAdminSession(): RtcAdminSession | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(LEGACY_RTC_ADMIN_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const session = parseStoredAdminSession(raw);
  storage.removeItem(LEGACY_RTC_ADMIN_SESSION_STORAGE_KEY);
  if (!session) {
    return null;
  }
  saveAdminSession(session);
  return session;
}

export function loadAdminSession(): RtcAdminSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  discardLegacyPersistedAdminSession();

  const storage = getSessionStorage();
  const raw = storage?.getItem(RTC_ADMIN_SESSION_STORAGE_KEY) ?? null;
  if (raw) {
    return parseStoredAdminSession(raw);
  }

  return migrateLegacyAdminSession();
}

export function saveAdminSession(session: RtcAdminSession): void {
  if (typeof window === "undefined") {
    return;
  }
  discardLegacyPersistedAdminSession();
  try {
    window.sessionStorage.setItem(RTC_ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Restricted context: the in-memory session still works for this page life.
  }
  window.sessionStorage.removeItem(LEGACY_RTC_ADMIN_SESSION_STORAGE_KEY);
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(RTC_ADMIN_SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_RTC_ADMIN_SESSION_STORAGE_KEY);
  // Legacy cleanup: older builds wrote the admin token to localStorage.
  discardLegacyPersistedAdminSession();
}
