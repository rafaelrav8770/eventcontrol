// supabase-config.js
// Archivo de configuracion para la coneccion con Supabase
// se carga en todas las paginas que necesitan acceder a la base de datos
// como el admin, la confirmacion y el control de acceso
//
// nota: este archivo depende de que env.js ya se haya cargado antes
// porque de ahi saca las credenciales (URL y API key)

// agarramos las credenciales que env.js puso en window.ENV
const env = window.ENV || {};
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

// si no estan las credenciales tiramos un error en consola
// esto pasa cuando env.js no se cargo o no tiene las variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL: Supabase credentials not found. Make sure env.js is loaded before supabase-config.js');
}

// creamos el cliente de supabase una sola vez y lo guardamos en window
// asi cualquier otro script que lo necesite puede acceder a el
// sin tener que crearlo de nuevo (patron singleton basicamente)
if (!window.supabaseClient && window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
