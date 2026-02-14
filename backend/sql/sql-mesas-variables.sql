-- ========================================================================
-- PASO 1: VERIFICAR ESTRUCTURA DE LA TABLA 'tables'
-- ========================================================================

-- Verificar estructura (solo lectura, no modifica nada)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tables'
ORDER BY ordinal_position;


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

