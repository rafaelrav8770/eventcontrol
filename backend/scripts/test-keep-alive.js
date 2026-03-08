// test-keep-alive.js
// script rapido para probar la conexion a Supabase
// hace un fetch directo al REST API sin usar la libreria de supabase
// asi verificamos que las credenciales del .env esten bien configuradas
// esto lo usamos nomas para debuggear cuando algo no jalaba

import 'dotenv/config';

// leemos las variables del .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// si no estan definidas no tiene caso seguir
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing .env variables. Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
    process.exit(1);
}

// funcion que prueba la coneccion haciendo un GET al API REST
async function testConnection() {
    console.log('Testing connection to:', SUPABASE_URL);

    try {
        // hacemos un fetch a la tabla pases_invitados pidiendo solo 1 registro
        // los headers llevan la apikey y el bearer token que supabase requiere
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pases_invitados?select=id&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        // si el status es 200 quiere decir que la conexion fue exitosa
        if (response.ok) {
            console.log('Connection SUCCESS! Status:', response.status);
            const data = await response.json();
            console.log('Data sample:', data);
        } else {
            // si no fue 200 algo fallo, mostramos el error
            console.error('Connection FAILED. Status:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response:', text);
        }

    } catch (error) {
        // si ni siquiera pudo conectarse cachamos la excepcion
        console.error('Fetch error:', error);
    }
}

// corremos la funcion
testConnection();
