// keep-alive.js — mantiene Supabase activo
// el plan gratis pausa la BD si no la usas en varios dias
// este script le hace un "ping" para que no se duerma
// se corre con un cron job (GitHub Actions, Railway, etc)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function pingDatabase() {
    console.log(`[${new Date().toISOString()}] Pinging Supabase...`);

    try {
        // query simple solo para despertar la base
        const { data, error, count } = await supabase
            .from('pases_invitados')
            .select('id', { count: 'exact', head: true });

        if (error) {
            console.error('Ping failed:', error.message);
            process.exit(1);
        }

        console.log(`Ping successful. Table row count: ${count}`);
        process.exit(0);

    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

pingDatabase();
