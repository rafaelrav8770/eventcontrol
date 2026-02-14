// ============================================
// generate-env.js
// Genera frontend/js/env.js a partir de las
// variables de entorno (Vercel, etc).
// ============================================

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'frontend', 'js', 'env.js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  SUPABASE_URL o SUPABASE_ANON_KEY no están definidas.');
    console.warn('   Asegúrate de configurarlas en Vercel → Settings → Environment Variables.');
}

const content = `// ============================================
// env.js — Generado automáticamente por generate-env.js
// NO editar manualmente en producción.
// ============================================

window.ENV = {
    SUPABASE_URL: '${SUPABASE_URL}',
    SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}'
};
`;

// Asegurar que el directorio existe
mkdirSync(dirname(outputPath), { recursive: true });

writeFileSync(outputPath, content, 'utf-8');
console.log('✅ env.js generado correctamente en frontend/js/env.js');
