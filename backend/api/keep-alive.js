// keep-alive.js
// Script to keep Supabase project active by making a simple request
// Run this with a cron job (e.g. GitHub Actions or Railway)

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
        // Simple query to wake up the database
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
