// create-users.js
// Script para crear los usarios del sistema en Supabase Auth
// tambien les crea su perfil en la tabla perfiles_usuario con su rol correspondiente
// esto solo se corre una vez al inicio del proyecto para el setup
//
// como correrlo: node backend/scripts/create-users.js
// (hay que tener las variables de entorno en .env)

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// --- credenciales del archivo .env ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// validamos que esten definidas las variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    console.error('Example: set SUPABASE_URL=https://... && set SUPABASE_ANON_KEY=... && node backend/scripts/create-users.js');
    process.exit(1);
}

// creamos el cliente de supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// arreglo con los usarios que vamos a crear
// cada uno tiene email, contraseña, nombre y rol
const USERS_TO_CREATE = [
    {
        email: 'eventcontrol@miboda.com',
        password: 'Event2026',
        name: 'Event Control Admin',
        role: 'admin' // este es el administrador principal del sistema
    },
    {
        email: 'eventcontrolrecepcion@miboda.com',
        password: 'recepevent2026',
        name: 'Recepción',
        role: 'access_control' // este es el de la entrada, el que escanea los QR
    }
];

// funcion principal que crea los usarios uno por uno
async function createUsers() {
    console.log('Starting user creation...');

    // recorremos el arreglo de usuarios
    for (const user of USERS_TO_CREATE) {
        console.log(`\nProcessing: ${user.email} (${user.role})`);

        try {
            // paso 1: registramos al usuario en el sistema de autenticacion de Supabase
            // usamos signUp que es la funcion para crear cuentas nuevas
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
                // si ya existia el usuario no importa, seguimos con el siguiente
                continue;
            }

            // obtenemos el ID del usuario recien creado
            const userId = data.user?.id;

            // si no hay ID es porque seguramente requiere confirmacion por email
            if (!userId) {
                console.error('No User ID returned. Signup might require confirmation.');
                continue;
            }

            console.log(`User created. ID: ${userId}`);

            // paso 2: creamos el perfil del usuario en nuestra tabla personalizada
            // usamos upsert por si ya existia, asi lo actualiza en vez de fallar
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
            // cachamos cualquier error inesperado
            console.error('Unexpected error:', err);
        }
    }

    console.log('\nDone.');
}

// ejecutamos la funcion
createUsers();
