-- Script para verificar la configuración de usuarios y perfiles
-- Ejecutar en Supabase SQL Editor para diagnosticar problemas de login

-- ========================================================================
-- PASO 1: Verificar que existen los usuarios en user_profiles
-- ========================================================================
SELECT 
    id,
    email,
    first_name,
    role,
    created_at
FROM user_profiles
ORDER BY created_at DESC;

-- ========================================================================
-- PASO 2: Insertar/Actualizar perfiles con los UUIDs correctos
-- ========================================================================
-- Basado en la captura de pantalla proporcionada

-- Perfil del NOVIO (Abidan)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    '375c26ed-6284-49bb-a9d9-aee27ea64f45',
    'abi@miboda.com',
    'Abidan',
    'groom'
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    role = EXCLUDED.role;

-- Perfil de la NOVIA (Betsaida)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    '40cb3f00-02af-4816-89ac-6a4127b69100',
    'betsi@miboda.com',
    'Betsaida',
    'bride'
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    role = EXCLUDED.role;

-- Perfil del CONTROL DE ACCESO (Recepción)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    'e1049ca1-3d66-4cf6-ab4e-08d5362c76c1',
    'recepcion@miboda.com',
    'Recepción',
    'access_control'
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    role = EXCLUDED.role;

-- ========================================================================
-- PASO 3: Verificar que los perfiles se crearon correctamente
-- ========================================================================
SELECT 
    id,
    email,
    first_name,
    role,
    created_at
FROM user_profiles
WHERE id IN (
    '375c26ed-6284-49bb-a9d9-aee27ea64f45',
    '40cb3f00-02af-4816-89ac-6a4127b69100',
    'e1049ca1-3d66-4cf6-ab4e-08d5362c76c1'
);
