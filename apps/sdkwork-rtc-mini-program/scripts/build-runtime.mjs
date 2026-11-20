import * as esbuild from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function readRuntimeDefaults() {
  const configPath =
    process.env.SDKWORK_RTC_MP_RUNTIME_CONFIG ??
    path.join(root, "../config/mini-program/runtime-env.json");
  const examplePath = path.join(root, "../config/mini-program/runtime-env.development.example.json");

  let rawConfig = {};
  if (existsSync(configPath)) {
    rawConfig = JSON.parse(readFileSync(configPath, "utf8"));
  } else if (existsSync(examplePath)) {
    rawConfig = JSON.parse(readFileSync(examplePath, "utf8"));
  }

  const rtc = rawConfig.rtc ?? {};
  const appbase = rawConfig.appbase ?? {};

  return {
    apiBaseUrl:
      process.env.SDKWORK_RTC_MP_API_BASE_URL ??
      rtc.apiBaseUrl ??
      "http://127.0.0.1:18088/app/v3/api",
    appbaseLoginUrl:
      process.env.SDKWORK_RTC_MP_APPBASE_LOGIN_URL ??
      appbase.loginUrl ??
      "http://127.0.0.1:3900",
  };
}

// Canonical sibling packages that the runtime bundle depends on. Without this
// resolution pin, esbuild resolves `@sdkwork/sdk-common` / `@sdkwork/utils`
// through the nearest node_modules of the importing file — which after a
// workspace install is the generated transport package's nested copies — and
// the emitted bundle then embeds `*-typescript/generated/server-openapi` path
// strings that the consumer-import contract rejects (APP_SDK_INTEGRATION_SPEC
// section 9). Resolution order mirrors the shared SDK runtime surface: dist
// entry first, dist subpath, then the TypeScript source entry.
const workspaceRoot = path.resolve(root, "../../../..");
const canonicalSiblingPackages = {
  "@sdkwork/sdk-common": path.join(
    workspaceRoot,
    "sdkwork-sdk-commons/sdkwork-sdk-common-typescript",
  ),
  "@sdkwork/utils": path.join(workspaceRoot, "sdkwork-utils/packages/sdkwork-utils-typescript"),
};

const canonicalSiblingPackagesPlugin = {
  name: "canonical-sibling-packages",
  setup(build) {
    // Go regular expression: JS unicode flag `u` is not supported here.
    build.onResolve({ filter: /^@sdkwork\/(?:sdk-common|utils)(?:\/.+)?$/ }, (args) => {
      const segments = args.path.split("/");
      const packageName = `@${segments[1]}/${segments[2]}`;
      const packageDir = canonicalSiblingPackages[packageName];
      if (!packageDir) {
        return null;
      }
      const subPath = segments.slice(3).join("/");
      const candidates = subPath
        ? [
            path.join(packageDir, "dist", `${subPath}.js`),
            path.join(packageDir, "dist", subPath, "index.js"),
            path.join(packageDir, "src", `${subPath}.ts`),
          ]
        : [
            path.join(packageDir, "dist", "index.js"),
            path.join(packageDir, "src", "index.ts"),
          ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return { path: candidate };
        }
      }
      return null;
    });
  },
};

const runtimeDefaults = readRuntimeDefaults();

await esbuild.build({
  entryPoints: [path.join(root, "../src/bootstrap/runtimeBundle.ts")],
  bundle: true,
  outfile: path.join(root, "../src/runtime/rtc-app.js"),
  platform: "browser",
  format: "cjs",
  target: "es2019",
  logLevel: "info",
  plugins: [canonicalSiblingPackagesPlugin],
  // The committed runtime artifact is comment-free: module path comments would
  // otherwise embed resolved dependency paths into the shipped mini-program
  // source tree.
  minify: true,
  define: {
    __SDKWORK_RTC_DEFAULT_API_BASE_URL__: JSON.stringify(runtimeDefaults.apiBaseUrl),
    __SDKWORK_RTC_DEFAULT_APPBASE_LOGIN_URL__: JSON.stringify(runtimeDefaults.appbaseLoginUrl),
  },
});
