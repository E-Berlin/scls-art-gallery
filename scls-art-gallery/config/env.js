// config/env.js
// ✅ Node.js 环境下用 dotenv 读取 .env 文件
require('dotenv').config();

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const PORT = process.env.PORT || 5000;
const ADMIN_KEY = process.env.ADMIN_KEY || "ADMIN_KEY";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "SUPABASE_KEY"

module.exports = { SERVER_URL, FRONTEND_URL, PORT, ADMIN_KEY, SUPABASE_URL, SUPABASE_KEY };