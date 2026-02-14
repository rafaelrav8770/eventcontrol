// ============================================
// keep-alive.js — API endpoint para Vercel
// Hace un ping a Supabase para que la base de datos
// no se pause por inactividad (free tier)
// ============================================

import { createClient } from '@supabase/supabase-js';

// Credenciales de Supabase (la anon key es publica, todo bien)
const SUPABASE_URL = 'https://xethjgzynlkrwsirrzsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGhqZ3p5bmxrcndzaXJyenNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjQ3ODgsImV4cCI6MjA4NjAwMDc4OH0.wD_eGAbyqL9maM4sqqeZ7kuaVcmkAu3VkKW1k0DuYIg';

// Handler principal — se ejecuta cuando alguien llama a /api/keep-alive
export default async function handler(req, res) {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Hacemos una consulta ligera — solo contamos cuantos pases hay
        // Esto es suficiente para que Supabase no pause la BD
        const { data, error, count } = await supabase
            .from('guest_passes')
            .select('id', { count: 'exact', head: true });

        if (error) {
            console.error('Error en consulta Supabase:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`✅ Keep-alive exitoso - ${count} invitaciones en DB`);

        // Respondemos con info util y la fecha del proximo ping recomendado (4 dias)
        return res.status(200).json({
            success: true,
            message: '✅ Ping keep-alive de Supabase exitoso',
            passesCount: count,
            timestamp: new Date().toISOString(),
            nextPingRecommended: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
        });

    } catch (error) {
        console.error('Error general:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
