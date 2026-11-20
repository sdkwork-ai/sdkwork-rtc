#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const rtcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(rtcRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const registry = readJson("specs/provider-registry/platform-default.json");
const registryEntries = registry.plugins;
const implemented = registryEntries
  .filter((entry) => entry.adapterStatus === "implemented")
  .map((entry) => entry.providerKind);
const planned = registryEntries
  .filter((entry) => entry.adapterStatus === "planned")
  .map((entry) => entry.providerKind);

test("provider registry partitions every entry into implemented or planned", () => {
  assert.equal(registry.interfaceVersion, "provider-registry/v1");
  assert.equal(implemented.length + planned.length, registryEntries.length);
  for (const kind of implemented) {
    assert.ok(!planned.includes(kind), `${kind} cannot be both implemented and planned`);
  }
  for (const kind of [...implemented, ...planned]) {
    assert.match(kind, /^[a-z0-9-]+$/, `provider kind ${kind} must be lowercase kebab-case`);
  }
});

test("implemented provider kinds match the runtime factory registration set", () => {
  const pluginBootstrap = read("crates/sdkwork-rtc-plugin-bootstrap/src/lib.rs");
  assert.match(
    pluginBootstrap,
    /platform_default_implemented_provider_kinds/u,
    "runtime bootstrap must register factories only for implemented kinds",
  );
  assert.ok(implemented.includes("volcengine"), "volcengine stays the default implemented vendor");
  for (const kind of ["tencent", "agora", "aliyun", "livekit"]) {
    assert.ok(implemented.includes(kind), `${kind} must stay implemented`);
  }
});

test("every catalog vendor has a provider schema whose adapterStatus matches the registry", () => {
  const schemaLoader = read("crates/sdkwork-communication-rtc-service/src/provider/schema.rs");
  for (const entry of registryEntries) {
    const schema = readJson(`specs/provider-schemas/${entry.providerKind}.json`);
    assert.equal(schema.provider, entry.providerKind);
    assert.equal(
      schema.adapterStatus,
      entry.adapterStatus,
      `schema adapterStatus for ${entry.providerKind} must match the registry`,
    );
    assert.ok(schema.accountFields.length >= 0);
    assert.ok(schema.applicationFields.some((field) => field.key === "providerApplicationId"));
    assert.ok(
      schema.credentialRoles.length >= 1,
      `${entry.providerKind} must declare at least one credential role`,
    );
    for (const role of schema.credentialRoles) {
      for (const field of role.fields) {
        if (field.type === "secret_ref") {
          assert.match(
            field.placeholder ?? "",
            /^secret:\/\/rtc\//u,
            `${entry.providerKind} credential role ${role.role} must use secret://rtc/ references`,
          );
        }
      }
    }
    assert.ok(
      schemaLoader.includes(`specs/provider-schemas/${entry.providerKind}.json`),
      `schema loader must embed ${entry.providerKind}.json`,
    );
  }
});

test("provider catalog seed covers exactly the implemented vendors, not planned ones", () => {
  const catalog = read("database/seeds/common/002_rtc_provider_catalog.sql");
  const credentials = read("database/seeds/common/003_rtc_provider_credentials.sql");
  assert.equal(
    readJson("database/database.manifest.json").lifecycle.seedOnBoot,
    true,
    "the provider catalog is reference data and must apply on boot in every environment",
  );
  for (const kind of implemented) {
    assert.ok(catalog.includes(`'${kind}'`), `catalog seed must provision ${kind}`);
  }
  for (const kind of planned) {
    assert.ok(
      !catalog.includes(`'${kind}'`) && !credentials.includes(`'${kind}'`),
      `planned vendor ${kind} must stay out of the seeds until its adapter ships`,
    );
  }
  // Per-environment initialization contract: the seed is the same idempotent
  // reference set in every environment database, so the environment stamp is
  // the canonical console default and must satisfy the migration CHECK set.
  assert.ok(catalog.includes("'production'"), "seed rows carry the canonical environment stamp");
  const migration = read(
    "database/migrations/postgres/0003_rtc_provider_environment_check.up.sql",
  );
  for (const environment of ["development", "test", "staging", "production", "demo"]) {
    assert.ok(migration.includes(`'${environment}'`), `environment CHECK must allow ${environment}`);
  }
});

test("seed credential references match the provider schema secret placeholders", () => {
  const credentials = read("database/seeds/common/003_rtc_provider_credentials.sql");
  for (const kind of implemented) {
    const schema = readJson(`specs/provider-schemas/${kind}.json`);
    const placeholders = schema.credentialRoles
      .flatMap((role) => role.fields)
      .filter((field) => field.type === "secret_ref")
      .map((field) => field.placeholder)
      .filter(Boolean);
    assert.ok(placeholders.length >= 1, `${kind} schema must expose secret placeholders`);
    for (const placeholder of placeholders) {
      assert.ok(
        credentials.includes(placeholder),
        `${kind} credential seed must reference ${placeholder} exactly as the schema declares`,
      );
    }
  }
});

test("provider defaults bootstrap seeds only references, never secret material", () => {
  for (const file of [
    "database/seeds/common/002_rtc_provider_catalog.sql",
    "database/seeds/common/003_rtc_provider_credentials.sql",
  ]) {
    const sql = read(file);
    assert.doesNotMatch(sql, /plain:/u, `${file} must not use plain secret refs`);
    for (const line of sql.split("\n")) {
      if (!line.includes("secret://")) continue;
      assert.doesNotMatch(
        line,
        /secret:\/\/[^\s']*\s*,\s*--?\s*(key|secret|password)/iu,
        `${file} must not annotate secret refs with material`,
      );
    }
  }
  const defaultsCommand = read(
    "crates/sdkwork-routes-rtc-backend-api/src/service.rs",
  );
  assert.match(
    defaultsCommand,
    /credential_seeded: bool/u,
    "the provider defaults report must disclose that no credential material is seeded",
  );
});

test("platform tenant 100001 owns the seeded provider catalog", () => {
  const catalog = read("database/seeds/common/002_rtc_provider_catalog.sql");
  const credentials = read("database/seeds/common/003_rtc_provider_credentials.sql");
  // The tenant id is an unquoted BIGINT literal in the seed VALUES rows.
  assert.match(catalog, /,\s*100001,\s*0,/u, "catalog rows must scope to tenant 100001, organization 0");
  assert.match(credentials, /,\s*100001,\s*0,/u, "credential rows must scope to tenant 100001, organization 0");
});
