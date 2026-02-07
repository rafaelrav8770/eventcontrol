-- ========================================================================
-- SCRIPT SQL - SISTEMA DE MESAS CON CAPACIDADES VARIABLES
-- ========================================================================
-- 
-- Este script prepara la base de datos para el nuevo sistema de mesas
-- donde cada mesa puede tener una capacidad diferente.
-- 
-- [!] EJECUTAR EN: Supabase Dashboard > SQL Editor
-- ========================================================================

-- ========================================================================
-- PASO 1: VERIFICAR ESTRUCTURA DE LA TABLA 'tables'
-- ========================================================================
-- La tabla ya tiene la columna 'capacity' que permite diferentes tamaños
-- por mesa, así que NO se requieren cambios de esquema.
-- 
-- Estructura actual esperada:
--   id          UUID PRIMARY KEY
--   table_number INTEGER
--   capacity    INTEGER (capacidad de la mesa)
--   occupied_seats INTEGER DEFAULT 0
--   created_at  TIMESTAMP
-- ========================================================================

-- Verificar estructura (solo lectura, no modifica nada)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tables'
ORDER BY ordinal_position;


-- ========================================================================
-- PASO 2: (OPCIONAL) LIMPIAR MESAS EXISTENTES
-- ========================================================================
-- ⚠️ ADVERTENCIA: Solo ejecuta esto si quieres empezar desde cero.
-- Esto eliminará TODAS las mesas y deberás recrearlas.
-- Los pases de invitados existentes quedarán sin mesa asignada.
-- ========================================================================

-- [DESCOMENTAR PARA EJECUTAR - SOLO SI ESTÁS SEGURO]
-- DELETE FROM tables;


-- ========================================================================
-- PASO 3: (OPCIONAL) EJEMPLO - CREAR MESAS DE DIFERENTES TAMAÑOS
-- ========================================================================
-- Este es un ejemplo de cómo se verían las mesas con diferentes capacidades.
-- El nuevo sistema del dashboard creará estas mesas automáticamente.
-- ========================================================================

-- [DESCOMENTAR PARA EJECUTAR - SOLO COMO EJEMPLO]
/*
INSERT INTO tables (table_number, capacity, occupied_seats) VALUES
    (1, 10, 0),   -- Mesa 1: 10 personas
    (2, 10, 0),   -- Mesa 2: 10 personas
    (3, 10, 0),   -- Mesa 3: 10 personas
    (4, 15, 0),   -- Mesa 4: 15 personas
    (5, 15, 0),   -- Mesa 5: 15 personas
    (6, 2, 0),    -- Mesa 6: 2 personas (novios)
    (7, 8, 0),    -- Mesa 7: 8 personas
    (8, 8, 0);    -- Mesa 8: 8 personas
*/


-- ========================================================================
-- PASO 4: VERIFICAR MESAS ACTUALES
-- ========================================================================
-- Ejecuta esto para ver el estado actual de tus mesas

SELECT 
    table_number as "Mesa #",
    capacity as "Capacidad",
    occupied_seats as "Ocupados",
    (capacity - occupied_seats) as "Disponibles"
FROM tables
ORDER BY table_number;

-- Ver resumen por capacidad
SELECT 
    capacity as "Capacidad",
    COUNT(*) as "Cantidad de Mesas",
    SUM(capacity) as "Total Lugares"
FROM tables
GROUP BY capacity
ORDER BY capacity;


-- ========================================================================
-- PASO 5: (OPCIONAL) TABLA DE TIPOS DE MESA
-- ========================================================================
-- Esta tabla es OPCIONAL - puedes usarla para guardar tipos de mesa
-- predefinidos que aparezcan como opciones rápidas en el dashboard.
-- ========================================================================

-- [DESCOMENTAR PARA CREAR LA TABLA DE TIPOS]
/*
CREATE TABLE IF NOT EXISTS table_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,              -- "Mesa redonda grande"
    default_capacity INTEGER NOT NULL,  -- 10
    description TEXT,                 -- Descripción opcional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar tipos comunes
INSERT INTO table_types (name, default_capacity, description) VALUES
    ('Mesa de novios', 2, 'Mesa especial para los novios'),
    ('Mesa redonda pequeña', 8, 'Mesa redonda estándar'),
    ('Mesa redonda grande', 10, 'Mesa redonda para familias grandes'),
    ('Mesa rectangular', 12, 'Mesa rectangular para grupos'),
    ('Mesa larga', 15, 'Mesa larga para eventos especiales'),
    ('Mesa imperial', 20, 'Mesa muy grande para grupos extensos');

-- Habilitar RLS
ALTER TABLE table_types ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
CREATE POLICY "public_lectura_tipos_mesa"
ON table_types FOR SELECT
TO authenticated, anon
USING (true);

-- Política de escritura solo para autenticados
CREATE POLICY "admin_gestion_tipos_mesa"
ON table_types FOR ALL
TO authenticated
USING (true);
*/


-- ========================================================================
-- ✅ SCRIPT COMPLETO
-- ========================================================================
-- El nuevo sistema de mesas con capacidades variables está listo.
-- 
-- Ahora puedes ir al dashboard y:
-- 1. Agregar tipos de mesa (ej: 5 mesas de 10 personas)
-- 2. Agregar más tipos (ej: 3 mesas de 15 personas)  
-- 3. Guardar la configuración
-- 4. El sistema creará automáticamente las mesas con las capacidades correctas
-- ========================================================================
