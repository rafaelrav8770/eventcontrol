// ============================================
// supabase-config.js
// Conexión a Supabase — se carga en todas las páginas
// que necesitan base de datos (admin, confirm, access-control)
// ============================================

// Datos del proyecto en Supabase (la anon key es publica, tranqui)
const SUPABASE_URL = 'https://xethjgzynlkrwsirrzsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGhqZ3p5bmxrcndzaXJyenNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjQ3ODgsImV4cCI6MjA4NjAwMDc4OH0.wD_eGAbyqL9maM4sqqeZ7kuaVcmkAu3VkKW1k0DuYIg';

// Creamos el cliente una sola vez y lo guardamos en window
// asi cualquier otro script puede usarlo sin volver a crearlo
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
