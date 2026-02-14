-- ============================================
-- sql-mesas-variables.sql
-- Consultas de verificacion para las mesas.
-- Solo lectura: no modifica nada en la BD.
-- ============================================


-- 1. Ver la estructura de la tabla "mesas" (columnas y tipos)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'mesas'
ORDER BY ordinal_position;


-- 2. Ver todas las mesas con sus asientos disponibles
SELECT 
    numero_mesa as "Mesa #",
    capacidad as "Capacidad",
    asientos_ocupados as "Ocupados",
    (capacidad - asientos_ocupados) as "Disponibles"
FROM mesas
ORDER BY numero_mesa;

-- 3. Resumen agrupado por capacidad (cuantas mesas de cada tamaño hay)
SELECT 
    capacidad as "Capacidad",
    COUNT(*) as "Cantidad de Mesas",
    SUM(capacidad) as "Total Lugares"
FROM mesas
GROUP BY capacidad
ORDER BY capacidad;
