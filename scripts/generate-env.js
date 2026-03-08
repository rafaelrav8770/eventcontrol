// generate-env.js
// Este script genera el archivo frontend/js/env.js
// a partir de las variables de entorno del servidor (Vercel, etc)
// es necesario porque el frontend es HTML estatico y no puede leer
// las variables de entorno directamente, entonces las "inyectamos"
// en un archivo JS que se carga en el HTML
//
// se ejecuta automaticamente al hacer deploy con: npm run build

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// obtenemos la ruta del directorio actual
// (es un poco diferente en ES modules vs CommonJS)
const __dirname = dirname(fileURLToPath(import.meta.url));

// definimos donde se va a guardar el archivo generado
const outputPath = join(__dirname, '..', 'frontend', 'js', 'env.js');

// leemos las variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// si no estan definidas mostramos advertencia
// en produccion (Vercel) se configuran en Settings > Environment Variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  SUPABASE_URL o SUPABASE_ANON_KEY no están definidas.');
    console.warn('   Asegúrate de configurarlas en Vercel → Settings → Environment Variables.');
}

// armamos el contenido del archivo que vamos a generar
// basicamente un JS que pone las credenciales en window.ENV
const content = `// env.js — Generado automaticamente por generate-env.js
// NO editar manualmente en produccion, se sobreescribe en cada deploy

window.ENV = {
    SUPABASE_URL: '${SUPABASE_URL}',
    SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}'
};
`;

// nos aseguramos que el directorio exista (si no, lo crea)
mkdirSync(dirname(outputPath), { recursive: true });

// escribimos el archivo
writeFileSync(outputPath, content, 'utf-8');
console.log('✅ env.js generado correctamente en frontend/js/env.js');
