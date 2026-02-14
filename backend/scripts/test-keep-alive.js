// scripts/test-keep-alive.js
// Simple script to test the keep-alive functionality locally

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing .env variables. Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
    process.exit(1);
}

async function testConnection() {
    console.log('Testing connection to:', SUPABASE_URL);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pases_invitados?select=id&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            console.log('Connection SUCCESS! Status:', response.status);
            const data = await response.json();
            console.log('Data sample:', data);
        } else {
            console.error('Connection FAILED. Status:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response:', text);
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testConnection();
