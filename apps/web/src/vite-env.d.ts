/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WC_PROJECT_ID?: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_BUILD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
