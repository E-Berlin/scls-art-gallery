// config/vite-env.d.ts
/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
      readonly VITE_SERVER_URL: string;
      readonly VITE_FRONTEND_URL: string;
      readonly VITE_SUPABASE_URL: string;
  }

  interface ImportMeta {
      readonly env: ImportMetaEnv;
  }
}
