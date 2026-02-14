-- ============================================
-- crear-base-datos.sql
-- Script principal para crear la base de datos
-- del sistema EventControl en Supabase.
-- Incluye: tablas, indices, RLS y datos iniciales.
-- ============================================


-- =============================================
-- TABLAS
-- =============================================

-- Configuracion general del evento (fecha, salon, etc.)
CREATE TABLE IF NOT EXISTS event_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_tables INTEGER DEFAULT 10,           -- cuantas mesas tiene el evento
    seats_per_table INTEGER DEFAULT 8,         -- sillas por mesa (referencia)
    event_date DATE,                           -- fecha del evento
    event_time TIME,                           -- hora del evento
    venue_name TEXT,                            -- nombre del salon
    venue_address TEXT,                         -- direccion del salon
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mesas del evento (cada mesa tiene capacidad y se vincula al evento)
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES event_config(id) ON DELETE CASCADE,  -- a que evento pertenece
    table_number INTEGER NOT NULL,             -- numero de mesa (1, 2, 3...)
    capacity INTEGER NOT NULL DEFAULT 10,      -- cuantas personas caben
    occupied_seats INTEGER DEFAULT 0,          -- cuantos asientos estan ocupados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pases de invitados (cada familia tiene un pase con codigo unico)
CREATE TABLE IF NOT EXISTS guest_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code VARCHAR(10) UNIQUE NOT NULL,   -- codigo de 4 digitos (ej: A3X7)
    family_name TEXT NOT NULL,                 -- nombre de la familia
    total_guests INTEGER NOT NULL DEFAULT 1,   -- cuantas personas incluye el pase
    guests_entered INTEGER DEFAULT 0,          -- cuantas ya entraron al evento
    table_id UUID REFERENCES tables(id),       -- mesa asignada
    phone VARCHAR(20),                         -- telefono (para WhatsApp)
    confirmed BOOLEAN DEFAULT FALSE,           -- si ya confirmo asistencia
    confirmed_at TIMESTAMP WITH TIME ZONE,     -- cuando confirmo
    all_entered BOOLEAN DEFAULT FALSE,         -- si ya entraron todos
    created_by UUID REFERENCES auth.users(id), -- quien creo el pase (novio o novia)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registros de entrada (cada vez que alguien entra al evento)
CREATE TABLE IF NOT EXISTS entry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID REFERENCES guest_passes(id),  -- a que pase pertenece esta entrada
    guests_count INTEGER NOT NULL,             -- cuantas personas entraron en este registro
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- hora de entrada
    registered_by UUID REFERENCES auth.users(id)        -- quien los registro (guardia)
);

-- Descargas de invitacion (cuando un invitado descarga su QR)
CREATE TABLE IF NOT EXISTS invitation_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID REFERENCES guest_passes(id),  -- que pase descargo la invitacion
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT                             -- IP desde donde descargo (referencia)
);

-- Perfiles de usuario (novio, novia, guardia, admin)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),  -- vinculado a auth de Supabase
    email TEXT,
    first_name TEXT,
    role TEXT CHECK (role IN ('groom', 'bride', 'access_control', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =============================================
-- INDICES (para que las busquedas sean rapidas)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_guest_passes_access_code ON guest_passes(access_code);
CREATE INDEX IF NOT EXISTS idx_guest_passes_table_id ON guest_passes(table_id);
CREATE INDEX IF NOT EXISTS idx_tables_table_number ON tables(table_number);
CREATE INDEX IF NOT EXISTS idx_entry_logs_pass_id ON entry_logs(pass_id);


-- =============================================
-- SEGURIDAD: Row Level Security (RLS)
-- Controla quien puede leer/escribir cada tabla
-- =============================================

ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;


-- =============================================
-- POLITICAS RLS
-- Define los permisos de lectura/escritura
-- =============================================

-- Configuracion del evento: todos pueden leer, solo autenticados escriben
CREATE POLICY "public_read_event_config" ON event_config 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_write_event_config" ON event_config 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mesas: todos pueden leer, solo autenticados escriben
CREATE POLICY "public_read_tables" ON tables 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_write_tables" ON tables 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Pases: todos leen, autenticados crean/borran, todos actualizan (para confirmaciones)
CREATE POLICY "public_read_passes" ON guest_passes 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_insert_passes" ON guest_passes 
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "public_update_passes" ON guest_passes 
    FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "auth_delete_passes" ON guest_passes 
    FOR DELETE TO authenticated USING (true);

-- Entradas: todos leen, solo autenticados registran
CREATE POLICY "public_read_entry_logs" ON entry_logs 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_write_entry_logs" ON entry_logs 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Descargas de invitacion: todos pueden insertar, solo autenticados leen
CREATE POLICY "public_insert_downloads" ON invitation_downloads 
    FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "auth_read_downloads" ON invitation_downloads 
    FOR SELECT TO authenticated USING (true);

-- Perfiles de usuario: cada quien solo ve/edita el suyo
CREATE POLICY "user_read_own_profile" ON user_profiles 
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "user_insert_own_profile" ON user_profiles 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "user_update_own_profile" ON user_profiles 
    FOR UPDATE TO authenticated USING (auth.uid() = id);


-- =============================================
-- DATOS INICIALES
-- =============================================

-- Crear configuracion inicial del evento (10 mesas, 10 sillas c/u)
INSERT INTO event_config (total_tables, seats_per_table)
VALUES (10, 10)
ON CONFLICT DO NOTHING;


-- =============================================
-- VERIFICACION: listar todas las tablas creadas
-- =============================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
