// keep-alive.js
// Este script sirve para mantener activa la base de datos de Supabase
// porque en el plan gratuito se pausa si no la usas en un rato
// basicamente le mandamos un "ping" cada cierto tiempo para que no se duerma
// se ejecuta con un cron job (nosotros usamos GitHub Actions)
//
// Integrantes del equipo: EventControl
// Materia: Ingenieria de Software
// Fecha: Febrero 2026

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// sacamos las credenciales de las variables de entorno
// estas se definen en el archivo .env que no se sube al repo
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// checamos que existan las variables, si no pos no podemos hacer nada
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing environment variables');
    process.exit(1);
}

// creamos la coneccion a supabase con las credenciales
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// funcion asincrona que hace el ping a la base de datos
// nomas hace un query sencillo para que supabase sepa que seguimos usandola
async function pingDatabase() {
    console.log(`[${new Date().toISOString()}] Pinging Supabase...`);

    try {
        // hacemos un select sencillo a la tabla de pases_invitados
        // solo pedimos el conteo, no necesitamos los datos en si
        const { data, error, count } = await supabase
            .from('pases_invitados')
            .select('id', { count: 'exact', head: true });

        // si hay error lo mostramos y salimos con codigo 1
        if (error) {
            console.error('Ping failed:', error.message);
            process.exit(1);
        }

        // si todo salio bien imprimimos el conteo de filas
        console.log(`Ping successful. Table row count: ${count}`);
        process.exit(0);

    } catch (err) {
        // si pasa algo inesperado lo cachamos aqui
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

// ejecutamos la funcion principal
pingDatabase();
