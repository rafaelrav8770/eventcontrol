-- ============================================
-- crear-base-datos.sql
-- Script principal para crear la base de datos
-- del sistema EventControl en Supabase.
-- Incluye: tablas, indices, RLS y datos iniciales.
-- NOTA: Nombres en español.
-- ============================================


-- =============================================
-- TABLAS
-- =============================================

-- Configuracion general del evento (fecha, salon, etc.)
CREATE TABLE IF NOT EXISTS configuracion_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_mesas INTEGER DEFAULT 10,             -- cuantas mesas tiene el evento
    asientos_por_mesa INTEGER DEFAULT 8,        -- sillas por mesa (referencia)
    fecha_evento DATE,                          -- fecha del evento
    hora_evento TIME,                           -- hora del evento
    nombre_salon TEXT,                          -- nombre del salon
    direccion_salon TEXT,                       -- direccion del salon
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mesas del evento (cada mesa tiene capacidad y se vincula al evento)
CREATE TABLE IF NOT EXISTS mesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID REFERENCES configuracion_evento(id) ON DELETE CASCADE,
    numero_mesa INTEGER NOT NULL,               -- numero de mesa (1, 2, 3...)
    capacidad INTEGER NOT NULL DEFAULT 10,      -- cuantas personas caben
    asientos_ocupados INTEGER DEFAULT 0,        -- cuantos asientos estan ocupados
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pases de invitados (cada familia tiene un pase con codigo unico)
CREATE TABLE IF NOT EXISTS pases_invitados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_acceso VARCHAR(10) UNIQUE NOT NULL,   -- codigo de 4 digitos (ej: A3X7)
    nombre_familia TEXT NOT NULL,                -- nombre de la familia
    total_invitados INTEGER NOT NULL DEFAULT 1,  -- cuantas personas incluye el pase
    invitados_ingresados INTEGER DEFAULT 0,      -- cuantas ya entraron al evento
    mesa_id UUID REFERENCES mesas(id),           -- mesa asignada
    telefono VARCHAR(20),                        -- telefono (para WhatsApp)
    confirmado BOOLEAN DEFAULT FALSE,            -- si ya confirmo asistencia
    confirmado_en TIMESTAMP WITH TIME ZONE,      -- cuando confirmo
    todos_ingresaron BOOLEAN DEFAULT FALSE,      -- si ya entraron todos
    creado_por UUID REFERENCES auth.users(id),   -- quien creo el pase (novio o novia)
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registros de entrada (cada vez que alguien entra al evento)
CREATE TABLE IF NOT EXISTS registros_entrada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pase_id UUID REFERENCES pases_invitados(id),         -- a que pase pertenece
    cantidad_invitados INTEGER NOT NULL,                  -- cuantas personas entraron
    ingreso_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),    -- hora de entrada
    registrado_por UUID REFERENCES auth.users(id)         -- quien los registro (guardia)
);

-- Descargas de invitacion (cuando un invitado descarga su QR)
CREATE TABLE IF NOT EXISTS descargas_invitacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pase_id UUID REFERENCES pases_invitados(id),         -- que pase descargo
    descargado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    direccion_ip TEXT                                     -- IP desde donde descargo
);

-- Perfiles de usuario (novio, novia, guardia, admin)
CREATE TABLE IF NOT EXISTS perfiles_usuario (
    id UUID PRIMARY KEY REFERENCES auth.users(id),       -- vinculado a auth de Supabase
    correo TEXT,
    nombre TEXT,
    rol TEXT CHECK (rol IN ('groom', 'bride', 'access_control', 'admin')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =============================================
-- INDICES (para que las busquedas sean rapidas)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_pases_codigo_acceso ON pases_invitados(codigo_acceso);
CREATE INDEX IF NOT EXISTS idx_pases_mesa_id ON pases_invitados(mesa_id);
CREATE INDEX IF NOT EXISTS idx_mesas_numero ON mesas(numero_mesa);
CREATE INDEX IF NOT EXISTS idx_registros_pase_id ON registros_entrada(pase_id);


-- =============================================
-- SEGURIDAD: Row Level Security (RLS)
-- =============================================

ALTER TABLE configuracion_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pases_invitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE descargas_invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuario ENABLE ROW LEVEL SECURITY;


-- =============================================
-- POLITICAS RLS
-- =============================================

-- Configuracion del evento: todos pueden leer, solo autenticados escriben
CREATE POLICY "lectura_publica_config" ON configuracion_evento 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "escritura_auth_config" ON configuracion_evento 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mesas: todos pueden leer, solo autenticados escriben
CREATE POLICY "lectura_publica_mesas" ON mesas 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "escritura_auth_mesas" ON mesas 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Pases: todos leen, autenticados crean/borran, todos actualizan (para confirmaciones)
CREATE POLICY "lectura_publica_pases" ON pases_invitados 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "insertar_auth_pases" ON pases_invitados 
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "actualizar_publica_pases" ON pases_invitados 
    FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "borrar_auth_pases" ON pases_invitados 
    FOR DELETE TO authenticated USING (true);

-- Entradas: todos leen, solo autenticados registran
CREATE POLICY "lectura_publica_entradas" ON registros_entrada 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "insertar_auth_entradas" ON registros_entrada 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Descargas de invitacion: todos pueden insertar, solo autenticados leen
CREATE POLICY "insertar_publica_descargas" ON descargas_invitacion 
    FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "lectura_auth_descargas" ON descargas_invitacion 
    FOR SELECT TO authenticated USING (true);

-- Perfiles de usuario: cada quien solo ve/edita el suyo
CREATE POLICY "leer_propio_perfil" ON perfiles_usuario 
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "insertar_propio_perfil" ON perfiles_usuario 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "actualizar_propio_perfil" ON perfiles_usuario 
    FOR UPDATE TO authenticated USING (auth.uid() = id);


-- =============================================
-- DATOS INICIALES
-- =============================================

-- Crear configuracion inicial del evento (10 mesas, 10 sillas c/u)
INSERT INTO configuracion_evento (total_mesas, asientos_por_mesa)
VALUES (10, 10)
ON CONFLICT DO NOTHING;


-- =============================================
-- VERIFICACION: listar todas las tablas creadas
-- =============================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
