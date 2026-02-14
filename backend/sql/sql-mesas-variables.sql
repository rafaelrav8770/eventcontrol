-- ============================================
-- sql-mesas-variables.sql
-- Consultas de verificacion para las mesas.
-- Solo lectura: no modifica nada en la BD.
-- ============================================


-- 1. Ver la estructura de la tabla "tables" (columnas y tipos)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tables'
ORDER BY ordinal_position;


-- 2. Ver todas las mesas con sus asientos disponibles
SELECT 
    table_number as "Mesa #",
    capacity as "Capacidad",
    occupied_seats as "Ocupados",
    (capacity - occupied_seats) as "Disponibles"
FROM tables
ORDER BY table_number;

-- 3. Resumen agrupado por capacidad (cuantas mesas de cada tamaño hay)
SELECT 
    capacity as "Capacidad",
    COUNT(*) as "Cantidad de Mesas",
    SUM(capacity) as "Total Lugares"
FROM tables
GROUP BY capacity
ORDER BY capacity;
