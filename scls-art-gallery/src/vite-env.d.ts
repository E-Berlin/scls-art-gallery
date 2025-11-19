// config/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SERVER_URL: string;
    readonly VITE_FRONTEND_URL: string;
    readonly VITE_SUPABASE_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
