-- crear-base-datos.sql
-- Script para crear la estructura completa de la base de datos
-- de nuestro sistema de control de invitados para la boda
--
-- incluye:
--   - tabla de configuracion del evento
--   - tabla de mesas
--   - tabla de pases de invitados (la mas importante)
--   - tabla de registros de entrada (logs)
--   - tabla de descargas (invitaciones)
--   - tabla de perfiles de usario
--
-- tambien tiene los indices para busquedas rapidas
-- y las politicas de seguridad RLS (Row Level Security)
-- que es lo que permite que supabase sea seguro sin backend
--
-- como usarlo: copiar y pegar todo esto en el SQL Editor de Supabase

-- =============================================
-- TABLA: configuracion_evento
-- guarda datos generales del evento: cuantas mesas hay,
-- capacidad por mesa, etc
-- =============================================
CREATE TABLE configuracion_evento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_mesas INTEGER DEFAULT 10,          -- cuantas mesas tiene el salon
    asientos_por_mesa INTEGER DEFAULT 8,     -- capacidad default de cada mesa
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: mesas
-- cada fila es una mesa del evento
-- el campo asientos_ocupados se actualiza automaticamente
-- cuando se asignan invitados
-- =============================================
CREATE TABLE mesas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero_mesa INTEGER NOT NULL,                -- numero de la mesa (1, 2, 3...)
    capacidad INTEGER NOT NULL DEFAULT 8,        -- cuantos invitados caben
    asientos_ocupados INTEGER DEFAULT 0,         -- cuantos ya estan asignados
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: pases_invitados
-- esta es la tabla principal del sistema
-- cada pase tiene un codigo unico de 4 digitos
-- que el invitado usa para confirmar y para entrar al evento
-- =============================================
CREATE TABLE pases_invitados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_familia VARCHAR(255) NOT NULL,         -- ej: "Familia Rodriguez"
    telefono VARCHAR(20),                          -- telefono para WhatsApp
    total_invitados INTEGER NOT NULL DEFAULT 2,    -- cuantos vienen con este pase
    codigo_acceso CHAR(4) NOT NULL UNIQUE,        -- el codigo de 4 caracteres
    mesa_id UUID REFERENCES mesas(id),            -- a que mesa estan asignados
    confirmado BOOLEAN DEFAULT FALSE,              -- si ya confirmo asistencia
    confirmado_en TIMESTAMP WITH TIME ZONE,        -- cuando confirmo
    invitados_ingresados INTEGER DEFAULT 0,        -- cuantos ya entraron
    todos_ingresaron BOOLEAN DEFAULT FALSE,        -- si ya entraron todos
    creado_por UUID REFERENCES auth.users(id),     -- quien creo este pase (novio o novia)
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: registros_entrada
-- cada vez que alguien del pase entra al evento
-- se registra aqui con la hora y quien lo verifico
-- =============================================
CREATE TABLE registros_entrada (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pase_id UUID REFERENCES pases_invitados(id),   -- a que pase pertenece
    invitados_ingresando INTEGER DEFAULT 1,         -- cuantos entran en este registro
    verificado_por UUID REFERENCES auth.users(id),  -- el staff que los dejo pasar
    registrado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: descargas_invitacion
-- lleva un conteo de cuantas veces descargan la invitacion
-- nomas es para estadisticas, no afecta nada
-- =============================================
CREATE TABLE descargas_invitacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pase_id UUID REFERENCES pases_invitados(id),
    descargado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: perfiles_usuario
-- guarda informacion extra de los usuarios del sistema
-- (los de auth.users solo tienen email y password)
-- aqui ponemos el nombre, rol, etc
-- =============================================
CREATE TABLE perfiles_usuario (
    id UUID PRIMARY KEY REFERENCES auth.users(id),  -- mismo ID que en auth
    correo VARCHAR(255),
    nombre VARCHAR(255),
    rol VARCHAR(50) DEFAULT 'admin',                -- admin, groom, bride, access_control
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDICES
-- para que las busquedas sean mas rapidas
-- =============================================

-- indice para buscar pases por codigo (se usa MUCHO)
CREATE INDEX idx_pases_codigo ON pases_invitados(codigo_acceso);

-- indice para buscar pases por mesa
CREATE INDEX idx_pases_mesa ON pases_invitados(mesa_id);

-- indice para buscar registros de un pase especifico
CREATE INDEX idx_registros_pase ON registros_entrada(pase_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- estas politicas definen quien puede leer y escribir cada tabla
-- basicamente: los usuarios autenticados pueden hacer todo
-- porque el sistema no tiene usuarios publicos
-- =============================================

-- habilitamos RLS en todas las tablas
ALTER TABLE configuracion_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pases_invitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE descargas_invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuario ENABLE ROW LEVEL SECURITY;

-- politicas de lectura: todos los autenticados pueden leer todo
CREATE POLICY "read_config" ON configuracion_evento FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_tables" ON mesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_passes" ON pases_invitados FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_entries" ON registros_entrada FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_profiles" ON perfiles_usuario FOR SELECT TO authenticated USING (true);

-- politicas de escritura: todos los autenticados pueden insertar
CREATE POLICY "insert_config" ON configuracion_evento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "insert_tables" ON mesas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "insert_passes" ON pases_invitados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "insert_entries" ON registros_entrada FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "insert_profiles" ON perfiles_usuario FOR INSERT TO authenticated WITH CHECK (true);

-- politicas de actualizacion: todos los autenticados pueden actualizar
CREATE POLICY "update_config" ON configuracion_evento FOR UPDATE TO authenticated USING (true);
CREATE POLICY "update_tables" ON mesas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "update_passes" ON pases_invitados FOR UPDATE TO authenticated USING (true);
CREATE POLICY "update_profiles" ON perfiles_usuario FOR UPDATE TO authenticated USING (true);

-- politicas de eliminacion: todos los autenticados pueden borrar
CREATE POLICY "delete_tables" ON mesas FOR DELETE TO authenticated USING (true);
CREATE POLICY "delete_passes" ON pases_invitados FOR DELETE TO authenticated USING (true);
CREATE POLICY "delete_entries" ON registros_entrada FOR DELETE TO authenticated USING (true);

-- politica especial: la pagina de confirmacion necesita leer pases sin auth
-- porque los invitados no estan logeados cuando meten su codigo
CREATE POLICY "public_read_passes" ON pases_invitados FOR SELECT TO anon USING (true);

-- politica para que los anonimos puedan actualizar la confirmacion
CREATE POLICY "public_update_passes" ON pases_invitados FOR UPDATE TO anon USING (true);

-- la confirmacion tambien necesita leer la config
CREATE POLICY "public_read_config" ON configuracion_evento FOR SELECT TO anon USING (true);

-- lectura publica de mesas (pa que se vea el numero de mesa en la confirmacion)
CREATE POLICY "public_read_tables" ON mesas FOR SELECT TO anon USING (true);

-- los anonimos pueden registrar descargas
CREATE POLICY "insert_downloads_anon" ON descargas_invitacion FOR INSERT TO anon WITH CHECK (true);
