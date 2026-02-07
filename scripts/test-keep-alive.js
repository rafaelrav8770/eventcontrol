// Configuración de Supabase
const SUPABASE_URL = 'https://pwrixdojbrmtwyfmygys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cml4ZG9qYnJtdHd5Zm15Z3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MTkyNTQsImV4cCI6MjA4MjE5NTI1NH0.xR7kmjDRiECOu7usPyzNKcg-dtIQCRNdnuI49Sl799U';

async function testKeepAlive() {
    console.log('🔍 Probando conexión keep-alive a Supabase...\n');

    try {
        // Realizar consulta usando REST API de Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/guest_passes?select=id&limit=1`, {
            method: 'HEAD',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'count=exact'
            }
        });

        if (!response.ok) {
            console.error('❌ Error HTTP:', response.status, response.statusText);
            process.exit(1);
        }

        const count = response.headers.get('content-range')?.split('/')[1] || '0';

        console.log('✅ ÉXITO - Ping keep-alive de Supabase completado');
        console.log(`📊 Invitaciones en DB: ${count}`);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`🔄 Próximo ping recomendado: ${new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()}\n`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error general:', error.message);
        process.exit(1);
    }
}

testKeepAlive();
