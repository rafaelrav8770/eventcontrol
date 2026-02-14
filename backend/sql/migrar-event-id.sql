-- ============================================
-- Migracion: Conectar tables con event_config
-- Ejecutar esto en el SQL Editor de Supabase
-- para que event_config aparezca conectada.
-- ============================================

-- 1. Agregar la columna event_id a la tabla "tables"
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES event_config(id) ON DELETE CASCADE;

-- 2. Vincular todas las mesas existentes al evento actual
UPDATE tables 
SET event_id = (SELECT id FROM event_config LIMIT 1)
WHERE event_id IS NULL;

-- 3. Verificar que se conecto bien
SELECT t.table_number, t.capacity, e.venue_name
FROM tables t
JOIN event_config e ON t.event_id = e.id
ORDER BY t.table_number;
