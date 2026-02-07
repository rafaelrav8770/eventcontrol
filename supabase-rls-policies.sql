/*
 * RLS Policies
 * Wedding Invitation System
 */

/* Enable RLS */

ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;


/* Event Config Policies */

-- Permitir que CUALQUIERA lea la configuración del evento
-- Justificación: La página de invitación pública necesita mostrar nombre,
-- fecha y ubicación del evento sin requerir login
CREATE POLICY "public_lectura_configuracion_evento"
ON event_config FOR SELECT
TO authenticated, anon
USING (true);

-- Solo usuarios autenticados pueden actualizar la configuración
-- Justificación: Protege datos sensibles, solo administradores logueados
CREATE POLICY "admin_actualizar_configuracion_evento"
ON event_config FOR UPDATE
TO authenticated
USING (true);

-- Solo usuarios autenticados pueden insertar nueva configuración
-- Justificación: Previene que usuarios anónimos creen configuraciones falsas
CREATE POLICY "admin_crear_configuracion_evento"
ON event_config FOR INSERT
TO authenticated
WITH CHECK (true);


/* Tables Policies */

-- Permitir que CUALQUIERA lea información de las mesas
-- Justificación: La página de confirmación necesita mostrar mesas disponibles
CREATE POLICY "public_lectura_mesas"
ON tables FOR SELECT
TO authenticated, anon
USING (true);

-- Solo usuarios autenticados pueden gestionar (crear/actualizar/eliminar) mesas
-- Justificación: Solo administradores deben poder modificar la distribución
CREATE POLICY "admin_gestion_completa_mesas"
ON tables FOR ALL
TO authenticated
USING (true);


/* Guest Passes Policies */

-- Permitir que CUALQUIERA lea los pases de invitado
-- Justificación: El sistema de confirmación pública necesita validar códigos
-- y recuperar información de la familia al ingresar el código
CREATE POLICY "public_lectura_invitaciones"
ON guest_passes FOR SELECT
TO authenticated, anon
USING (true);

-- Solo usuarios autenticados pueden crear nuevos pases de invitado
-- Justificación: Solo administradores deben poder generar invitaciones
CREATE POLICY "admin_crear_invitaciones"
ON guest_passes FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir que CUALQUIERA actualice pases (para confirmaciones)
-- Justificación: Los invitados necesitan cambiar su estado de "pendiente" 
-- a "confirmado" desde la página pública de confirmación
CREATE POLICY "public_actualizar_confirmacion_invitacion"
ON guest_passes FOR UPDATE
TO authenticated, anon
USING (true);

-- Solo usuarios autenticados pueden eliminar pases
-- Justificación: Control de administrador para gestionar invitaciones
CREATE POLICY "admin_eliminar_invitaciones"
ON guest_passes FOR DELETE
TO authenticated
USING (true);


/* Entry Logs Policies */

-- Permitir que CUALQUIERA lea los registros de entrada
-- Justificación: La página de monitoreo en vivo necesita mostrar quién ha
-- ingresado al evento sin requerir autenticación
CREATE POLICY "public_lectura_registros_entrada"
ON entry_logs FOR SELECT
TO authenticated, anon
USING (true);

-- Solo usuarios autenticados pueden crear registros de entrada
-- Justificación: Solo el personal de control de acceso debe registrar entradas
CREATE POLICY "access_control_crear_registro_entrada"
ON entry_logs FOR INSERT
TO authenticated
WITH CHECK (true);


/* Invitation Downloads Policies */

-- Permitir que CUALQUIERA registre una descarga
-- Justificación: Los invitados descargan invitaciones desde la página pública
-- y el sistema necesita rastrear estas descargas para estadísticas
CREATE POLICY "public_registrar_descarga_invitacion"
ON invitation_downloads FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Solo usuarios autenticados pueden leer estadísticas de descargas
-- Justificación: Información analítica solo para administradores
CREATE POLICY "admin_lectura_estadisticas_descargas"
ON invitation_downloads FOR SELECT
TO authenticated
USING (true);


/* User Profiles Policies */

-- Los usuarios solo pueden leer su propio perfil
-- Justificación: Privacidad - ningún usuario debe ver datos de otros
CREATE POLICY "usuario_lectura_propio_perfil"
ON user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Los usuarios solo pueden crear su propio perfil
-- Justificación: Evita que usuarios creen perfiles para otros
CREATE POLICY "usuario_crear_propio_perfil"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Los usuarios solo pueden actualizar su propio perfil
-- Justificación: Evita modificaciones no autorizadas de perfiles ajenos
CREATE POLICY "usuario_actualizar_propio_perfil"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);


/* Initial Admin Users */

-- [!] REEMPLAZAR ESTOS UUIDs CON LOS REALES DESPUÉS DE CREAR USUARIOS
-- [!] Los UUIDs actuales son de ejemplo y deben actualizarse

-- Configurar perfil del NOVIO (Abidan)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    '375c26ed-628d-49bb-a9d9-aee27ea64f45',  -- [!] ACTUALIZAR con UUID real
    'abi@miboda.com',                          -- Email del novio
    'Abidan',                                  -- Nombre del novio
    'groom'                                    -- [ROL] novio
)
ON CONFLICT (id) DO UPDATE 
SET role = 'groom', first_name = 'Abidan';

-- Configurar perfil de la NOVIA (Betsaida)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    '40cb3f00-02af-481c-89ac-6a4127b69100',  -- [!] ACTUALIZAR con UUID real
    'betsi@miboda.com',                        -- Email de la novia
    'Betsaida',                                -- Nombre de la novia
    'bride'                                    -- [ROL] novia
)
ON CONFLICT (id) DO UPDATE 
SET role = 'bride', first_name = 'Betsaida';

-- Configurar perfil del CONTROL DE ACCESO (Recepción)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    'e1049ca1-3d66-4cf5-ab4e-08d5362c76c1',  -- [!] ACTUALIZAR con UUID real
    'recepcion@miboda.com',                    -- Email de recepción
    'Recepción',                               -- Nombre para recepción
    'access_control'                           -- [ROL] control de acceso
)
ON CONFLICT (id) DO UPDATE 
SET role = 'access_control', first_name = 'Recepción';


/* End of Policies */
