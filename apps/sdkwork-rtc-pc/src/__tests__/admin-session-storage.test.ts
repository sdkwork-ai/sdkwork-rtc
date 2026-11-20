// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import {
  RTC_ADMIN_SESSION_STORAGE_KEY,
  clearAdminSession,
  loadAdminSession,
  saveAdminSession,
  type RtcAdminSession,
} from "../bootstrap/adminSessionStorage";

/**
 * The RTC admin console used to persist its dual-token session in
 * `localStorage`, so the next account on the same browser/Electron profile was
 * signed in as the previous administrator without a prompt. The session now
 * lives in `sessionStorage` (per tab, gone when the tab closes) and is cleared
 * when the user session ends.
 */

const LEGACY_SESSION_STORAGE_KEY = "sdkwork.rtc.admin.session";

const adminSession: RtcAdminSession = {
  accessToken: "admin-access-token",
  authToken: "admin-auth-token",
  tenantId: "100001",
  organizationId: "default",
  userId: "administrator-1",
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("rtc admin session storage", () => {
  it("persists the admin session to sessionStorage, never to localStorage", () => {
    saveAdminSession(adminSession);

    expect(JSON.parse(window.sessionStorage.getItem(RTC_ADMIN_SESSION_STORAGE_KEY) ?? "{}"))
      .toMatchObject({ accessToken: "admin-access-token", userId: "administrator-1" });
    expect(window.localStorage.getItem(RTC_ADMIN_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("does not restore a legacy localStorage admin session", () => {
    window.localStorage.setItem(RTC_ADMIN_SESSION_STORAGE_KEY, JSON.stringify(adminSession));

    expect(loadAdminSession()).toBeNull();
    expect(window.localStorage.getItem(RTC_ADMIN_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("migrates the legacy sessionStorage key into the current one", () => {
    window.sessionStorage.setItem(LEGACY_SESSION_STORAGE_KEY, JSON.stringify(adminSession));

    const loaded = loadAdminSession();

    expect(loaded?.accessToken).toBe("admin-access-token");
    expect(window.sessionStorage.getItem(LEGACY_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(RTC_ADMIN_SESSION_STORAGE_KEY))
      .toContain("admin-access-token");
  });

  it("clears the admin session from both storages on sign-out", () => {
    saveAdminSession(adminSession);
    window.localStorage.setItem(RTC_ADMIN_SESSION_STORAGE_KEY, JSON.stringify(adminSession));
    window.localStorage.setItem(LEGACY_SESSION_STORAGE_KEY, JSON.stringify(adminSession));

    clearAdminSession();

    expect(window.sessionStorage.getItem(RTC_ADMIN_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(RTC_ADMIN_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("keeps a saved admin session for the current tab", () => {
    saveAdminSession(adminSession);

    expect(loadAdminSession()).toMatchObject({
      accessToken: "admin-access-token",
      authToken: "admin-auth-token",
    });
  });
});
