-- ============================================
-- migrar-a-espanol.sql
-- EJECUTAR ESTO EN EL SQL EDITOR DE SUPABASE
-- Renombra todas las tablas y columnas de
-- inglés a español.
-- ⚠️ HACER ESTO ANTES DE ACTUALIZAR EL CÓDIGO
-- ============================================


-- =============================================
-- PASO 1: Renombrar columnas de event_config
-- =============================================
ALTER TABLE event_config RENAME COLUMN total_tables TO total_mesas;
ALTER TABLE event_config RENAME COLUMN seats_per_table TO asientos_por_mesa;
ALTER TABLE event_config RENAME COLUMN event_date TO fecha_evento;
ALTER TABLE event_config RENAME COLUMN event_time TO hora_evento;
ALTER TABLE event_config RENAME COLUMN venue_name TO nombre_salon;
ALTER TABLE event_config RENAME COLUMN venue_address TO direccion_salon;
ALTER TABLE event_config RENAME COLUMN created_at TO creado_en;
ALTER TABLE event_config RENAME COLUMN updated_at TO actualizado_en;


-- =============================================
-- PASO 2: Renombrar columnas de tables
-- =============================================
ALTER TABLE tables RENAME COLUMN table_number TO numero_mesa;
ALTER TABLE tables RENAME COLUMN capacity TO capacidad;
ALTER TABLE tables RENAME COLUMN occupied_seats TO asientos_ocupados;
ALTER TABLE tables RENAME COLUMN created_at TO creado_en;
-- event_id → evento_id (si existe)
DO $$ BEGIN
    ALTER TABLE tables RENAME COLUMN event_id TO evento_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;


-- =============================================
-- PASO 3: Renombrar columnas de guest_passes
-- =============================================
ALTER TABLE guest_passes RENAME COLUMN access_code TO codigo_acceso;
ALTER TABLE guest_passes RENAME COLUMN family_name TO nombre_familia;
ALTER TABLE guest_passes RENAME COLUMN total_guests TO total_invitados;
ALTER TABLE guest_passes RENAME COLUMN guests_entered TO invitados_ingresados;
ALTER TABLE guest_passes RENAME COLUMN table_id TO mesa_id;
ALTER TABLE guest_passes RENAME COLUMN phone TO telefono;
ALTER TABLE guest_passes RENAME COLUMN confirmed TO confirmado;
ALTER TABLE guest_passes RENAME COLUMN confirmed_at TO confirmado_en;
ALTER TABLE guest_passes RENAME COLUMN all_entered TO todos_ingresaron;
ALTER TABLE guest_passes RENAME COLUMN created_by TO creado_por;
ALTER TABLE guest_passes RENAME COLUMN created_at TO creado_en;
ALTER TABLE guest_passes RENAME COLUMN updated_at TO actualizado_en;


-- =============================================
-- PASO 4: Renombrar columnas de entry_logs
-- =============================================
ALTER TABLE entry_logs RENAME COLUMN pass_id TO pase_id;
ALTER TABLE entry_logs RENAME COLUMN guests_count TO cantidad_invitados;
ALTER TABLE entry_logs RENAME COLUMN entered_at TO ingreso_en;
ALTER TABLE entry_logs RENAME COLUMN registered_by TO registrado_por;


-- =============================================
-- PASO 5: Renombrar columnas de invitation_downloads
-- =============================================
ALTER TABLE invitation_downloads RENAME COLUMN pass_id TO pase_id;
ALTER TABLE invitation_downloads RENAME COLUMN downloaded_at TO descargado_en;
ALTER TABLE invitation_downloads RENAME COLUMN ip_address TO direccion_ip;


-- =============================================
-- PASO 6: Renombrar columnas de user_profiles
-- =============================================
ALTER TABLE user_profiles RENAME COLUMN email TO correo;
ALTER TABLE user_profiles RENAME COLUMN first_name TO nombre;
ALTER TABLE user_profiles RENAME COLUMN role TO rol;
ALTER TABLE user_profiles RENAME COLUMN created_at TO creado_en;


-- =============================================
-- PASO 7: Renombrar las TABLAS
-- (se deja al final para no romper los pasos anteriores)
-- =============================================
ALTER TABLE event_config RENAME TO configuracion_evento;
ALTER TABLE tables RENAME TO mesas;
ALTER TABLE guest_passes RENAME TO pases_invitados;
ALTER TABLE entry_logs RENAME TO registros_entrada;
ALTER TABLE invitation_downloads RENAME TO descargas_invitacion;
ALTER TABLE user_profiles RENAME TO perfiles_usuario;


-- =============================================
-- PASO 8: Verificar que todo quedo bien
-- =============================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
