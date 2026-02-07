-- DIAGNÓSTICO RÁPIDO DE LOGIN
-- Ejecuta este script completo en Supabase SQL Editor

-- ==================================================
-- PASO 1: Ver usuarios en Authentication
-- ==================================================
-- No se puede hacer desde SQL, pero verifica en:
-- Supabase Dashboard > Authentication > Users
-- Que el email esté "Confirmed"

-- ==================================================
-- PASO 2: Verificar si existe el perfil del usuario
-- ==================================================
SELECT * FROM user_profiles 
WHERE email IN ('recepcion@miboda.com', 'abi@miboda.com', 'betsi@miboda.com');

-- Si no aparecen usuarios, ejecuta el PASO 3
-- Si aparecen usuarios, verifica que tengan los roles correctos

-- ==================================================
-- PASO 3: Crear/Actualizar perfiles con los UUIDs correctos
-- ==================================================
-- IMPORTANTE: Usa los UUIDs que ves en Authentication > Users

-- Recepción (control de acceso)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    'e1049ca1-3d66-4cf6-ab4e-08d5362c76c1',  -- UUID del usuario recepcion@miboda.com
    'recepcion@miboda.com',
    'Recepción',
    'access_control'
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = 'recepcion@miboda.com',
    first_name = 'Recepción',
    role = 'access_control';

-- Novio (Abidan)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    '375c26ed-6284-49bb-a9d9-aee27ea64f45',  -- UUID del usuario abi@miboda.com
    'abi@miboda.com',
    'Abidan',
    'groom'
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = 'abi@miboda.com',
    first_name = 'Abidan',
    role = 'groom';

-- Novia (Betsaida)
INSERT INTO user_profiles (id, email, first_name, role)
VALUES (
    '40cb3f00-02af-4816-89ac-6a4127b69100',  -- UUID del usuario betsi@miboda.com
    'betsi@miboda.com',
    'Betsaida',
    'bride'
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = 'betsi@miboda.com',
    first_name = 'Betsaida',
    role = 'bride';

-- ==================================================
-- PASO 4: Verificar que se crearon correctamente
-- ==================================================
SELECT 
    id,
    email,
    first_name,
    role,
    created_at
FROM user_profiles 
WHERE email IN ('recepcion@miboda.com', 'abi@miboda.com', 'betsi@miboda.com')
ORDER BY created_at DESC;

-- Deberías ver 3 filas con los datos correctos
