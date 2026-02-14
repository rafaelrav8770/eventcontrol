
-- Tabla de configuración del evento
CREATE TABLE IF NOT EXISTS event_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_tables INTEGER DEFAULT 10,
    seats_per_table INTEGER DEFAULT 8,
    event_date DATE,
    event_time TIME,
    venue_name TEXT,
    venue_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de mesas
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 10,
    occupied_seats INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de pases de invitados
CREATE TABLE IF NOT EXISTS guest_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code VARCHAR(10) UNIQUE NOT NULL,
    family_name TEXT NOT NULL,
    total_guests INTEGER NOT NULL DEFAULT 1,
    guests_entered INTEGER DEFAULT 0,
    table_id UUID REFERENCES tables(id),
    phone VARCHAR(20),
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    all_entered BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de registros de entrada
CREATE TABLE IF NOT EXISTS entry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID REFERENCES guest_passes(id),
    guests_count INTEGER NOT NULL,
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registered_by UUID REFERENCES auth.users(id)
);

-- Tabla de descargas de invitación
CREATE TABLE IF NOT EXISTS invitation_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID REFERENCES guest_passes(id),
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT
);

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    first_name TEXT,
    role TEXT CHECK (role IN ('groom', 'bride', 'access_control', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


/* Indexes */

CREATE INDEX IF NOT EXISTS idx_guest_passes_access_code ON guest_passes(access_code);
CREATE INDEX IF NOT EXISTS idx_guest_passes_table_id ON guest_passes(table_id);
CREATE INDEX IF NOT EXISTS idx_tables_table_number ON tables(table_number);
CREATE INDEX IF NOT EXISTS idx_entry_logs_pass_id ON entry_logs(pass_id);


/* Row Level Security (RLS) */

ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;


/* RLS Policies */

-- Event Config - Lectura pública, escritura autenticada
CREATE POLICY "public_read_event_config" ON event_config 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_write_event_config" ON event_config 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables - Lectura pública, escritura autenticada
CREATE POLICY "public_read_tables" ON tables 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_write_tables" ON tables 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Guest Passes - Lectura pública, escritura autenticada, actualización pública (para confirmaciones)
CREATE POLICY "public_read_passes" ON guest_passes 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_insert_passes" ON guest_passes 
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "public_update_passes" ON guest_passes 
    FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "auth_delete_passes" ON guest_passes 
    FOR DELETE TO authenticated USING (true);

-- Entry Logs - Lectura pública, escritura autenticada
CREATE POLICY "public_read_entry_logs" ON entry_logs 
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "auth_write_entry_logs" ON entry_logs 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Invitation Downloads - Inserción pública, lectura autenticada
CREATE POLICY "public_insert_downloads" ON invitation_downloads 
    FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "auth_read_downloads" ON invitation_downloads 
    FOR SELECT TO authenticated USING (true);

-- User Profiles - Solo el propio usuario
CREATE POLICY "user_read_own_profile" ON user_profiles 
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "user_insert_own_profile" ON user_profiles 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "user_update_own_profile" ON user_profiles 
    FOR UPDATE TO authenticated USING (auth.uid() = id);


/* Initial Config */

-- Crear configuración inicial del evento
INSERT INTO event_config (total_tables, seats_per_table)
VALUES (10, 10)
ON CONFLICT DO NOTHING;


/* Verification */
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
