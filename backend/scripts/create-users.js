// create-users.js — crea usuarios nuevos en Supabase Auth
// les crea su perfil en perfiles_usuario con su rol
// se corre una vez nomas para el setup inicial
//
// uso: node backend/scripts/create-users.js

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// --- credenciales del .env ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    console.error('Example: set SUPABASE_URL=https://... && set SUPABASE_ANON_KEY=... && node backend/scripts/create-users.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USERS_TO_CREATE = [
    {
        email: 'eventcontrol@miboda.com',
        password: 'Event2026',
        name: 'Event Control Admin',
        role: 'admin' // este es el admin del sistema
    },
    {
        email: 'eventcontrolrecepcion@miboda.com',
        password: 'recepevent2026',
        name: 'Recepción',
        role: 'access_control'
    }
];

async function createUsers() {
    console.log('Starting user creation...');

    for (const user of USERS_TO_CREATE) {
        console.log(`\nProcessing: ${user.email} (${user.role})`);

        try {
            // 1. registramos al usuario en auth
            const { data, error } = await supabase.auth.signUp({
                email: user.email,
                password: user.password,
                options: {
                    data: {
                        full_name: user.name
                    }
                }
            });

            if (error) {
                console.error(`Error signing up ${user.email}:`, error.message);

                // si ya existe no pasa nada, seguimos con el siguiente
                // But with anon key we can't see users list easily.
                // We'll try to update profile anyway if we can get the ID from a login?
                // For now, just log and continue.
                continue;
            }

            const userId = data.user?.id;

            if (!userId) {
                console.error('No User ID returned. Signup might require confirmation.');
                continue;
            }

            console.log(`User created. ID: ${userId}`);

            // 2. creamos/actualizamos el perfil con upsert
            const { error: profileError } = await supabase
                .from('perfiles_usuario')
                .upsert({
                    id: userId,
                    correo: user.email,
                    nombre: user.name,
                    rol: user.role
                }, { onConflict: 'id' });

            if (profileError) {
                console.error(`Error updating profile for ${user.email}:`, profileError.message);
            } else {
                console.log(`Profile updated for ${user.email} with role: ${user.role}`);
            }

        } catch (err) {
            console.error('Unexpected error:', err);
        }
    }

    console.log('\nDone.');
}

createUsers();
