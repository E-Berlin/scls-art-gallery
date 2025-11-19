// config/config.ts
// ✅ 前端 Vite/TSX 环境
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";
export const FRONTEND_URL: string = import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173";
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;