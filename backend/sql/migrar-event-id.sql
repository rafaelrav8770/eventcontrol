-- ============================================
-- migrar-event-id.sql
-- Migracion: Conectar mesas con configuracion_evento
-- Ejecutar esto en el SQL Editor de Supabase
-- para que configuracion_evento aparezca conectada.
-- ============================================

-- 1. Agregar la columna evento_id a la tabla "mesas"
ALTER TABLE mesas 
ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES configuracion_evento(id) ON DELETE CASCADE;

-- 2. Vincular todas las mesas existentes al evento actual
UPDATE mesas 
SET evento_id = (SELECT id FROM configuracion_evento LIMIT 1)
WHERE evento_id IS NULL;

-- 3. Verificar que se conecto bien
SELECT m.numero_mesa, m.capacidad, e.nombre_salon
FROM mesas m
JOIN configuracion_evento e ON m.evento_id = e.id
ORDER BY m.numero_mesa;
