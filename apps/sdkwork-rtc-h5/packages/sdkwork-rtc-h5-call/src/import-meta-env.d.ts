// Ambient Vite import.meta.env surface for packages compiled outside the app
// tsconfig (root workspace typecheck includes packages/ but not app src).
interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
