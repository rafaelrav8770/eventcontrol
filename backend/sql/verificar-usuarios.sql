-- ============================================
-- verificar-usuarios.sql
-- Crea/actualiza los perfiles de usuario en
-- Supabase para los 3 roles del sistema:
-- novio, novia y control de acceso.
-- ============================================


-- 1. Ver los perfiles que ya existen
SELECT 
    id,
    correo,
    nombre,
    rol,
    creado_en
FROM perfiles_usuario
ORDER BY creado_en DESC;


-- 2. Crear/actualizar el perfil del NOVIO (Abidan)
INSERT INTO perfiles_usuario (id, correo, nombre, rol)
VALUES (
    '375c26ed-6284-49bb-a9d9-aee27ea64f45',
    'abi@miboda.com',
    'Abidan',
    'groom'
)
ON CONFLICT (id) DO UPDATE 
SET 
    correo = EXCLUDED.correo,
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol;

-- 3. Crear/actualizar el perfil de la NOVIA (Betsaida)
INSERT INTO perfiles_usuario (id, correo, nombre, rol)
VALUES (
    '40cb3f00-02af-4816-89ac-6a4127b69100',
    'betsi@miboda.com',
    'Betsaida',
    'bride'
)
ON CONFLICT (id) DO UPDATE 
SET 
    correo = EXCLUDED.correo,
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol;

-- 4. Crear/actualizar el perfil del GUARDIA (Recepcion / control de acceso)
INSERT INTO perfiles_usuario (id, correo, nombre, rol)
VALUES (
    'e1049ca1-3d66-4cf6-ab4e-08d5362c76c1',
    'recepcion@miboda.com',
    'Recepción',
    'access_control'
)
ON CONFLICT (id) DO UPDATE 
SET 
    correo = EXCLUDED.correo,
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol;


-- 5. Verificar que los 3 perfiles quedaron bien
SELECT 
    id,
    correo,
    nombre,
    rol,
    creado_en
FROM perfiles_usuario
WHERE id IN (
    '375c26ed-6284-49bb-a9d9-aee27ea64f45',
    '40cb3f00-02af-4816-89ac-6a4127b69100',
    'e1049ca1-3d66-4cf6-ab4e-08d5362c76c1'
);
