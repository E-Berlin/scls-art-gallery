// config/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SERVER_URL: string;
    readonly VITE_FRONTEND_URL: string;
    readonly VITE_SUPABASE_URL: string;
    // 可以加更多 VITE_ 前缀的环境变量
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
