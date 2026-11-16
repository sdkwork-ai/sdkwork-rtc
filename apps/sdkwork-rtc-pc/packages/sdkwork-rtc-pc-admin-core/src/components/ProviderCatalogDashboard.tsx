import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  ProviderProfileVerifyResult,
  RtcAdminCenterServices,
} from "../types/adminServices";
import type { ProviderAccount } from "../types/providerAccount";
import type { ProviderApplication } from "../types/providerApplication";
import type { ProviderCredential } from "../types/providerCredential";
import type { ProviderProfile } from "../types/providerProfile";
import type { ProviderProfileCommand } from "../types/providerProfile";
import type { ProviderRoute } from "../types/providerRoute";
import type {
  ConfigFieldSchema,
  CredentialRoleSchema,
  ProviderConfigSchema,
  ProviderPluginDescriptor,
} from "../types/providerSchema";
import { formatSdkWorkError } from "../sdk/index.js";

export interface ProviderCatalogDashboardProps {
  services: RtcAdminCenterServices;
  schemas: ProviderConfigSchema[];
  plugins: ProviderPluginDescriptor[];
  accounts: ProviderAccount[];
  profiles: ProviderProfile[];
  routes: ProviderRoute[];
  loading?: boolean;
  onChanged: () => Promise<void> | void;
}

interface ProviderBundle {
  account: ProviderAccount | null;
  application: ProviderApplication | null;
  credentials: ProviderCredential[];
  profile: ProviderProfile | null;
  route: ProviderRoute | null;
}

interface EditorState {
  schema: ProviderConfigSchema;
  bundle: ProviderBundle;
  applicationId: string;
  region: string;
  endpoint: string;
  profileName: string;
  priority: string;
  isDefault: boolean;
  secrets: Record<string, string>;
  verification: ProviderProfileVerifyResult | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const CAPABILITY_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["media.audio", "audio"],
  ["media.video", "video"],
  ["live.broadcast", "liveBroadcast"],
  ["live.audience", "liveAudience"],
  ["cdn-relay", "cdnRelay"],
  ["screen-share", "screenShare"],
  ["recording", "recording"],
  ["provider.webhook", "webhook"],
  ["provider.active-query", "activeQuery"],
];

function schemaField(
  schema: ProviderConfigSchema,
  section: "applicationFields" | "profileFields",
  key: string,
): ConfigFieldSchema | undefined {
  return schema[section]?.find((field) => field.key === key);
}

function fieldDefault(
  schema: ProviderConfigSchema,
  section: "applicationFields" | "profileFields",
  key: string,
  fallback = "",
): string {
  const field = schemaField(schema, section, key);
  if (!field || field.default == null) {
    return fallback;
  }
  return String(field.default);
}

function applicationKind(schema: ProviderConfigSchema): string {
  return (
    fieldDefault(schema, "applicationFields", "providerApplicationIdKind") ||
    schema.applicationFields?.find((field) => field.key === "providerApplicationIdKind")?.values?.[0] ||
    "app_id"
  );
}

function credentialRef(role: CredentialRoleSchema, provider: string): string {
  const field = role.fields?.find((candidate) => candidate.key === "credentialRef");
  const placeholder = (field as { placeholder?: string } | undefined)?.placeholder;
  return placeholder && placeholder.trim().length > 0
    ? placeholder
    : `secret://rtc/${provider}/${role.role}`;
}

function capabilitiesFromSchema(
  schema: ProviderConfigSchema,
  region: string,
): ProviderProfileCommand["capabilities"] {
  const declared = new Set([
    ...(schema.requiredCapabilities ?? []),
    ...(schema.optionalCapabilities ?? []),
  ]);
  const enabled = (capability: string) => declared.has(capability);
  return {
    audio: enabled("media.audio"),
    video: enabled("media.video"),
    live: enabled("live.broadcast") || enabled("live.audience"),
    liveBroadcast: enabled("live.broadcast"),
    liveAudience: enabled("live.audience"),
    cdnRelay: enabled("cdn-relay"),
    screenShare: enabled("screen-share"),
    recording: enabled("recording"),
    webhook: enabled("provider.webhook"),
    activeQuery: enabled("provider.active-query"),
    maxParticipants: undefined,
    supportedRegions: region ? [region] : [],
    providerFeatures: {},
  };
}

function defaultRegion(schema: ProviderConfigSchema): string {
  return (
    fieldDefault(schema, "profileFields", "region") ||
    schema.profileFields?.find((field) => field.key === "region")?.values?.[0] ||
    ""
  );
}

function defaultEndpoint(schema: ProviderConfigSchema): string {
  return fieldDefault(schema, "profileFields", "endpoint");
}

function maskApplicationId(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 10) {
    return trimmed;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Seeded rows carry a `seed-…` placeholder until the operator enters the real App ID. */
function isPlaceholderApplicationId(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith("seed-"));
}

export function ProviderCatalogDashboard({
  services,
  schemas,
  plugins,
  accounts,
  profiles,
  routes,
  loading = false,
  onChanged,
}: ProviderCatalogDashboardProps) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [secretReady, setSecretReady] = useState<Record<string, boolean>>({});

  const pluginByProvider = useMemo(() => {
    const map = new Map<string, ProviderPluginDescriptor>();
    for (const plugin of plugins) {
      map.set(plugin.providerKind, plugin);
    }
    return map;
  }, [plugins]);

  const profileByProvider = useMemo(() => {
    const map = new Map<string, ProviderProfile>();
    for (const profile of profiles) {
      const current = map.get(profile.provider);
      if (!current || profile.isDefault || profile.priority < current.priority) {
        map.set(profile.provider, profile);
      }
    }
    return map;
  }, [profiles]);

  const accountByProvider = useMemo(() => {
    const map = new Map<string, ProviderAccount>();
    for (const account of accounts) {
      if (!map.has(account.provider)) {
        map.set(account.provider, account);
      }
    }
    return map;
  }, [accounts]);

  // The profile row records the credential *reference*, not whether the
  // operator already entered the secret. Load the linked application
  // credentials once so the card can distinguish "app id missing" from
  // "secret missing" without a per-card mutation round trip.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const next: Record<string, boolean> = {};
      for (const schema of schemas) {
        const account = accountByProvider.get(schema.provider);
        if (!account) {
          next[schema.provider] = false;
          continue;
        }
        try {
          const applications = await services.applications.list(account.id, { limit: 200 });
          const application =
            applications.items.find((candidate) => candidate.code === "default") ??
            applications.items[0];
          if (!application) {
            next[schema.provider] = false;
            continue;
          }
          const credentials = await services.credentials.list(application.id, { limit: 200 });
          const primaryRoles = (schema.credentialRoles ?? []).filter(
            (role) => role.role === "rtc_token_signing" || role.role === "usersig_signing",
          );
          next[schema.provider] =
            primaryRoles.length === 0 ||
            primaryRoles.every((role) =>
              credentials.items.some(
                (credential) =>
                  credential.credentialRole === role.role && credential.secretConfigured,
              ),
            );
        } catch {
          next[schema.provider] = false;
        }
      }
      if (active) {
        setSecretReady(next);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [accountByProvider, schemas, services]);

  const openEditor = useCallback(
    async (schema: ProviderConfigSchema) => {
      const account = accountByProvider.get(schema.provider) ?? null;
      const profile =
        profiles.find((candidate) => candidate.provider === schema.provider) ?? null;
      const baseRegion = profile?.region ?? defaultRegion(schema);
      setEditor({
        schema,
        bundle: {
          account,
          application: null,
          credentials: [],
          profile,
          route: profile ? routes.find((route) => route.providerProfileId === profile.id) ?? null : null,
        },
        applicationId: isPlaceholderApplicationId(profile?.providerAppId)
          ? ""
          : profile?.providerAppId ?? "",
        region: baseRegion,
        endpoint: profile?.endpoint ?? defaultEndpoint(schema),
        profileName: profile?.name ?? schema.displayName,
        priority: String(profile?.priority ?? 100),
        isDefault: profile?.isDefault ?? false,
        secrets: {},
        verification: null,
        loading: true,
        saving: false,
        error: null,
      });

      if (!account) {
        setEditor((current) => (current ? { ...current, loading: false } : current));
        return;
      }
      try {
        const applications = await services.applications.list(account.id, { limit: 200 });
        const application =
          applications.items.find((candidate) => candidate.code === "default") ??
          applications.items[0] ??
          null;
        const credentials = application
          ? (await services.credentials.list(application.id, { limit: 200 })).items
          : [];
        setEditor((current) =>
          current
            ? {
                ...current,
                bundle: { ...current.bundle, account, application, credentials },
                applicationId:
                  current.applicationId || application?.providerApplicationId || "",
                region: current.region || application?.region || defaultRegion(schema),
                loading: false,
              }
            : current,
        );
      } catch (error) {
        setEditor((current) =>
          current
            ? {
                ...current,
                loading: false,
                error: formatSdkWorkError(
                  error,
                  t("admin.rtc.providerCatalog.loadFailed", "Failed to load provider configuration"),
                ),
              }
            : current,
        );
      }
    },
    [accountByProvider, profiles, routes, services, t],
  );

  const closeEditor = useCallback(() => setEditor(null), []);

  const updateEditor = useCallback((patch: Partial<EditorState>) => {
    setEditor((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const saveEditor = useCallback(async () => {
    if (!editor) {
      return;
    }
    const applicationId = editor.applicationId.trim();
    if (!applicationId) {
      updateEditor({
        error: t(
          "admin.rtc.providerCatalog.applicationIdRequired",
          "Enter the provider application ID (App ID / SDKAppId / API Key) before saving.",
        ),
      });
      return;
    }
    updateEditor({ saving: true, error: null });
    try {
      const schema = editor.schema;
      let account = editor.bundle.account;
      if (!account) {
        account = await services.accounts.create({
          provider: schema.provider,
          code: "default",
          name: schema.displayName,
          environment: "production",
        });
      }
      const applicationCommand = {
        code: "default",
        name: `${schema.displayName} App`,
        environment: "production",
        region: editor.region || undefined,
        providerApplicationId: applicationId,
        providerApplicationIdKind: applicationKind(schema),
        accessEndpoint: fieldDefault(schema, "applicationFields", "accessEndpoint", editor.endpoint) || undefined,
        apiEndpoint: fieldDefault(schema, "applicationFields", "apiEndpoint") || undefined,
        apiHost: fieldDefault(schema, "applicationFields", "apiHost") || undefined,
        apiVersion: fieldDefault(schema, "applicationFields", "apiVersion") || undefined,
        configSnapshot: {},
      };
      let application = editor.bundle.application;
      if (application) {
        application = await services.applications.update(application.id, applicationCommand);
      } else {
        application = await services.applications.create(account.id, applicationCommand);
      }

      const credentials = [...editor.bundle.credentials];
      let enteredSecret = false;
      for (const role of schema.credentialRoles ?? []) {
        const secret = editor.secrets[role.role]?.trim();
        if (!secret) {
          continue;
        }
        enteredSecret = true;
        const existing = credentials.find(
          (credential) => credential.credentialRole === role.role,
        );
        const command = {
          credentialRole: role.role,
          credentialKind: "secret_text",
          credentialLabel: role.label ?? role.role,
          credentialRef: credentialRef(role, schema.provider),
          credentialSecret: secret,
          status: "active" as const,
        };
        if (existing) {
          const updated = await services.credentials.update(existing.id, command);
          const index = credentials.findIndex((item) => item.id === updated.id);
          if (index >= 0) {
            credentials[index] = updated;
          }
        } else {
          credentials.push(await services.credentials.create(application.id, command));
        }
      }

      const primaryRole =
        schema.credentialRoles?.find((role) => role.role === "rtc_token_signing") ??
        schema.credentialRoles?.find((role) => role.role === "usersig_signing") ??
        schema.credentialRoles?.[0];
      const webhookRole = schema.credentialRoles?.find(
        (role) => role.role === "webhook_signing",
      );
      const profileCommand = {
        provider: schema.provider,
        code: "default",
        name: editor.profileName.trim() || schema.displayName,
        isDefault: editor.isDefault,
        priority: Number.parseInt(editor.priority, 10) || 100,
        environment: "production",
        region: editor.region || undefined,
        providerApplicationId: application.id,
        providerAppId: application.providerApplicationId,
        endpoint: editor.endpoint || undefined,
        credentialRef: primaryRole ? credentialRef(primaryRole, schema.provider) : undefined,
        webhookSecretRef: webhookRole ? credentialRef(webhookRole, schema.provider) : undefined,
        capabilities: capabilitiesFromSchema(schema, editor.region),
        configSnapshot: { credentialTtlSeconds: 3600 },
      };
      const profile = editor.bundle.profile
        ? await services.profiles.update(editor.bundle.profile.id, profileCommand)
        : await services.profiles.create(profileCommand);

      if (!editor.bundle.route) {
        await services.routes.create({
          providerProfileId: profile.id,
          routeType: "region",
          region: editor.region || undefined,
          priority: 100,
          status: "active",
        });
      }

      let verification: ProviderProfileVerifyResult | null = null;
      try {
        verification = await services.profiles.verify(profile.id, "full");
      } catch {
        verification = null;
      }
      setEditor((current) =>
        current
          ? {
              ...current,
              saving: false,
              bundle: { ...current.bundle, account, application, credentials, profile },
              verification,
            }
          : current,
      );
      if (enteredSecret) {
        setSecretReady((current) => ({ ...current, [schema.provider]: true }));
      }
      await onChanged();
    } catch (error) {
      updateEditor({
        saving: false,
        error: formatSdkWorkError(
          error,
          t("admin.rtc.providerCatalog.saveFailed", "Failed to save provider configuration"),
        ),
      });
    }
  }, [editor, onChanged, services, t, updateEditor]);

  const verifyProvider = useCallback(
    async (profile: ProviderProfile) => {
      try {
        const verification = await services.profiles.verify(profile.id, "full");
        setEditor((current) =>
          current && current.bundle.profile?.id === profile.id
            ? { ...current, verification }
            : current,
        );
        await onChanged();
      } catch (error) {
        updateEditor({
          error: formatSdkWorkError(
            error,
            t("admin.rtc.providerCatalog.verifyFailed", "Provider verification failed"),
          ),
        });
      }
    },
    [onChanged, services, t, updateEditor],
  );

  return (
    <section className="provider-catalog" aria-label={t("admin.rtc.providerCatalog.title", "RTC providers")}>
      <header className="provider-catalog-header">
        <div>
          <h2>{t("admin.rtc.providerCatalog.title", "RTC providers")}</h2>
          <p className="admin-muted">
            {t(
              "admin.rtc.providerCatalog.subtitle",
              "Every supported RTC provider is preconfigured. Enter the provider App ID and secret once, then calls work.",
            )}
          </p>
        </div>
        <button type="button" onClick={() => void onChanged()} disabled={loading}>
          {loading
            ? t("admin.rtc.loadingShort", "Loading...")
            : t("admin.rtc.providerCatalog.refresh", "Refresh")}
        </button>
      </header>

      <div className="provider-grid">
        {schemas.map((schema) => {
          const profile = profileByProvider.get(schema.provider) ?? null;
          const account = accountByProvider.get(schema.provider) ?? null;
          const plugin = pluginByProvider.get(schema.provider);
          const appIdConfigured =
            Boolean(profile?.providerAppId) &&
            !isPlaceholderApplicationId(profile?.providerAppId);
          const secretConfigured = secretReady[schema.provider] === true;
          const ready = Boolean(profile?.credentialRef) && appIdConfigured && secretConfigured;
          const statusLabel = !profile
            ? t("admin.rtc.providerCatalog.statusNotConfigured", "Not configured")
            : !appIdConfigured
              ? t("admin.rtc.providerCatalog.statusNeedsAppId", "Needs App ID")
              : ready
                ? t("admin.rtc.providerCatalog.statusReady", "Ready")
                : t("admin.rtc.providerCatalog.statusNeedsSecret", "Needs secret");
          const statusClass = !profile
            ? "health-unknown"
            : ready
              ? "health-healthy"
              : "health-degraded";
          return (
            <article key={schema.provider} className={`provider-card ${statusClass}`}>
              <div className="provider-card-header">
                <div>
                  <h3>{schema.displayName ?? plugin?.displayName ?? schema.provider}</h3>
                  <code>{schema.provider}</code>
                </div>
                <span className={`provider-status-pill ${statusClass}`}>{statusLabel}</span>
              </div>
              <p className="admin-muted">{schema.description}</p>
              <dl className="provider-card-facts">
                <div>
                  <dt>{t("admin.rtc.providerCatalog.account", "Account")}</dt>
                  <dd>{account ? account.name : t("admin.rtc.providerCatalog.missing", "Missing")}</dd>
                </div>
                <div>
                  <dt>{t("admin.rtc.providerCatalog.appId", "App ID")}</dt>
                  <dd>
                    {appIdConfigured && profile?.providerAppId
                      ? maskApplicationId(profile.providerAppId)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{t("admin.rtc.providerCatalog.region", "Region")}</dt>
                  <dd>{profile?.region ?? defaultRegion(schema) ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t("admin.rtc.providerCatalog.defaultProfile", "Default")}</dt>
                  <dd>{profile?.isDefault ? t("admin.rtc.yes", "Yes") : t("admin.rtc.no", "No")}</dd>
                </div>
              </dl>
              <div className="form-actions">
                <button type="button" onClick={() => void openEditor(schema)}>
                  {profile
                    ? t("admin.rtc.providerCatalog.edit", "Edit")
                    : t("admin.rtc.providerCatalog.configure", "Configure")}
                </button>
                {profile && (
                  <button type="button" onClick={() => void verifyProvider(profile)}>
                    {t("admin.rtc.providerCatalog.test", "Test")}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {editor && (
        <div className="admin-card provider-editor" role="dialog" aria-modal="true">
          <div className="provider-card-header">
            <div>
              <h2>
                {t("admin.rtc.providerCatalog.editorTitle", "Configure {{name}}", {
                  name: editor.schema.displayName ?? editor.schema.provider,
                })}
              </h2>
              <p className="admin-muted">
                {t(
                  "admin.rtc.providerCatalog.editorSubtitle",
                  "Only the App ID and provider secret are required. Account, application, profile and route are provisioned automatically.",
                )}
              </p>
            </div>
            <button type="button" onClick={closeEditor} aria-label={t("admin.rtc.cancel", "Cancel")}>
              ×
            </button>
          </div>

          {editor.loading && (
            <p>{t("admin.rtc.providerCatalog.loadingConfiguration", "Loading configuration...")}</p>
          )}
          {editor.error && (
            <div className="admin-error" role="alert">
              {editor.error}
            </div>
          )}

          <div className="provider-editor-grid">
            <div className="form-field">
              <label htmlFor="provider-app-id">
                {t("admin.rtc.providerCatalog.applicationId", "App ID / SDKAppId / API Key")}
              </label>
              <input
                id="provider-app-id"
                value={editor.applicationId}
                onChange={(event) => updateEditor({ applicationId: event.target.value })}
                placeholder={fieldDefault(editor.schema, "applicationFields", "providerApplicationId")}
              />
            </div>
            <div className="form-field">
              <label htmlFor="provider-region">
                {t("admin.rtc.providerCatalog.region", "Region")}
              </label>
              <input
                id="provider-region"
                value={editor.region}
                onChange={(event) => updateEditor({ region: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="provider-endpoint">
                {t("admin.rtc.providerCatalog.endpoint", "Endpoint")}
              </label>
              <input
                id="provider-endpoint"
                value={editor.endpoint}
                onChange={(event) => updateEditor({ endpoint: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="provider-profile-name">
                {t("admin.rtc.providerCatalog.profileName", "Profile name")}
              </label>
              <input
                id="provider-profile-name"
                value={editor.profileName}
                onChange={(event) => updateEditor({ profileName: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="provider-priority">
                {t("admin.rtc.providerCatalog.priority", "Priority")}
              </label>
              <input
                id="provider-priority"
                type="number"
                min={0}
                value={editor.priority}
                onChange={(event) => updateEditor({ priority: event.target.value })}
              />
            </div>
            <div className="form-field provider-default-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={editor.isDefault}
                  onChange={(event) => updateEditor({ isDefault: event.target.checked })}
                />
                {t("admin.rtc.providerCatalog.setDefault", "Use as default provider")}
              </label>
            </div>
          </div>

          <h3>{t("admin.rtc.providerCatalog.secrets", "Provider secrets")}</h3>
          <p className="admin-muted">
            {t(
              "admin.rtc.providerCatalog.secretsHint",
              "Secrets are sealed before storage and never returned. Existing secrets stay active when the field is left blank.",
            )}
          </p>
          <div className="provider-editor-grid">
            {(editor.schema.credentialRoles ?? []).map((role) => {
              const existing = editor.bundle.credentials.find(
                (credential) => credential.credentialRole === role.role,
              );
              return (
                <div className="form-field" key={role.role}>
                  <label htmlFor={`provider-secret-${role.role}`}>
                    {role.label ?? role.role}
                    {existing?.secretConfigured && (
                      <span className="provider-secret-configured">
                        ✓ {existing.secretMaskedLabel ?? t("admin.rtc.providerCatalog.configured", "Configured")}
                      </span>
                    )}
                  </label>
                  <input
                    id={`provider-secret-${role.role}`}
                    type="password"
                    autoComplete="new-password"
                    value={editor.secrets[role.role] ?? ""}
                    onChange={(event) =>
                      updateEditor({
                        secrets: { ...editor.secrets, [role.role]: event.target.value },
                      })
                    }
                    placeholder={
                      existing?.secretConfigured
                        ? t("admin.rtc.providerCatalog.keepExisting", "Leave blank to keep the existing secret")
                        : role.fields?.[0]?.label ?? t("admin.rtc.providerCatalog.enterSecret", "Enter secret")
                    }
                  />
                </div>
              );
            })}
          </div>

          {editor.verification && (
            <div className="provider-verification" role="status">
              <strong>
                {t("admin.rtc.providerCatalog.verification", "Verification")}:{" "}
                {editor.verification.status}
              </strong>
              <ul>
                {editor.verification.checks.map((check) => (
                  <li key={check.name} className={`verification-${check.status}`}>
                    {check.status === "passed" ? "✓ " : "! "}
                    {check.name}: {check.detail ?? check.status}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={closeEditor} disabled={editor.saving}>
              {t("admin.rtc.cancel", "Cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void saveEditor()}
              disabled={editor.saving || editor.loading}
            >
              {editor.saving
                ? t("admin.rtc.providerCatalog.saving", "Saving...")
                : t("admin.rtc.providerCatalog.save", "Save provider")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Exported for tests: the capability mapping contract used by the editor. */
export function providerCapabilitiesFromSchema(
  schema: ProviderConfigSchema,
  region: string,
): ProviderProfileCommand["capabilities"] {
  return capabilitiesFromSchema(schema, region);
}

/** Exported for tests: the App ID kind selected from a provider schema. */
export function providerApplicationKind(schema: ProviderConfigSchema): string {
  return applicationKind(schema);
}
