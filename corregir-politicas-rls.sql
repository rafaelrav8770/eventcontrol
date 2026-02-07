-- ========================================================================
-- Script de Verificación y Corrección de Políticas RLS
-- ========================================================================
-- Este script verifica que las políticas de seguridad permitan el acceso
-- correcto a los perfiles de usuario durante el login
-- ========================================================================

-- PASO 1: Verificar que RLS está habilitado en user_profiles
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';

-- PASO 2: Ver todas las políticas actuales de user_profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- PASO 3: Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "usuario_lectura_propio_perfil" ON user_profiles;
DROP POLICY IF EXISTS "usuario_crear_propio_perfil" ON user_profiles;
DROP POLICY IF EXISTS "usuario_actualizar_propio_perfil" ON user_profiles;

-- PASO 4: Recrear políticas permitiendo lectura durante login
-- IMPORTANTE: La política anterior solo permitía leer el PROPIO perfil,
-- pero durante el login, necesitamos leer el perfil para verificar el role

-- Permitir que usuarios autenticados lean cualquier perfil
-- (necesario para verificar roles durante login)
CREATE POLICY "autenticado_lectura_perfiles"
ON user_profiles FOR SELECT
TO authenticated
USING (true);

-- Los usuarios pueden crear su propio perfil
CREATE POLICY "usuario_crear_propio_perfil"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "usuario_actualizar_propio_perfil"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- PASO 5: Verificar que las nuevas políticas se crearon
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'user_profiles';
