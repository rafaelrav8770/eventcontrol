// ============================================
// supabase-config.js
// Conexión a Supabase — se carga en todas las páginas
// que necesitan base de datos (admin, confirm, access-control)
// ============================================

// Leemos las credenciales desde window.ENV (inyectado por env.js)
const env = window.ENV || {};
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL: Supabase credentials not found. Make sure env.js is loaded before supabase-config.js');
}

// Creamos el cliente una sola vez y lo guardamos en window
// asi cualquier otro script puede usarlo sin volver a crearlo
if (!window.supabaseClient && window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
