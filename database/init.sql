-- ============================================================
-- KARGO İŞLETME SİSTEMİ - PostgreSQL Şeması
-- Kocaeli Üniversitesi Yazılım Lab I - 2025-2026 Güz
-- ============================================================

-- PostGIS extension (harita koordinatları için)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE cargo_status AS ENUM ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE vehicle_status AS ENUM ('available', 'on_route', 'maintenance');
CREATE TYPE plan_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE vehicle_ownership AS ENUM ('owned', 'rented');

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- SYSTEM PARAMETERS (değiştirilebilir parametreler)
-- ============================================================

CREATE TABLE system_parameters (
    id SERIAL PRIMARY KEY,
    param_key VARCHAR(100) UNIQUE NOT NULL,
    param_value DECIMAL(10, 2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- STATIONS (İstasyonlar - Kocaeli İlçeleri)
-- ============================================================

CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,  -- örn: "GEBZE", "IZMIT"
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location GEOGRAPHY(POINT, 4326),   -- PostGIS için
    address TEXT,
    is_hub BOOLEAN DEFAULT false,       -- Ana merkez mi? (Kocaeli Üniversitesi)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_stations_code ON stations(code);
CREATE INDEX idx_stations_location ON stations USING GIST(location);

-- ============================================================
-- VEHICLES (Araçlar)
-- ============================================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    capacity_kg DECIMAL(10, 2) NOT NULL,      -- kg cinsinden kapasite
    fuel_consumption DECIMAL(5, 2) DEFAULT 0.1, -- lt/km
    ownership vehicle_ownership NOT NULL DEFAULT 'owned',
    rental_cost DECIMAL(10, 2) DEFAULT 0,      -- kiralık ise maliyet
    status vehicle_status DEFAULT 'available',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_capacity ON vehicles(capacity_kg);

-- ============================================================
-- CARGOS (Kargolar - Kullanıcı talepleri)
-- ============================================================

CREATE TABLE cargos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_code VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_station_id UUID NOT NULL REFERENCES stations(id),
    destination_station_id UUID REFERENCES stations(id), -- Hub'a gidecek
    weight_kg DECIMAL(10, 2) NOT NULL,
    description TEXT,
    status cargo_status DEFAULT 'pending',
    scheduled_date DATE,                -- Hangi gün için planlandı
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cargos_user ON cargos(user_id);
CREATE INDEX idx_cargos_status ON cargos(status);
CREATE INDEX idx_cargos_origin ON cargos(origin_station_id);
CREATE INDEX idx_cargos_scheduled ON cargos(scheduled_date);

-- ============================================================
-- DISTANCE MATRIX (İstasyonlar arası mesafe cache)
-- ============================================================

CREATE TABLE distance_matrix (
    id SERIAL PRIMARY KEY,
    from_station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    to_station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    distance_km DECIMAL(10, 3) NOT NULL,
    duration_minutes DECIMAL(10, 2) NOT NULL,
    polyline TEXT,                      -- Encoded polyline (yol çizimi için)
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_station_id, to_station_id)
);

CREATE INDEX idx_distance_from ON distance_matrix(from_station_id);
CREATE INDEX idx_distance_to ON distance_matrix(to_station_id);

-- ============================================================
-- PLANS (Rota Planları - Ertesi gün planlaması)
-- ============================================================

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_date DATE NOT NULL,            -- Plan hangi gün için
    problem_type VARCHAR(50) NOT NULL,  -- 'unlimited_vehicles' veya 'limited_vehicles'
    status plan_status DEFAULT 'draft',
    
    -- Optimizer sonuçları
    total_distance_km DECIMAL(10, 3),
    total_cost DECIMAL(10, 2),
    total_cargos INTEGER,
    total_weight_kg DECIMAL(10, 2),
    vehicles_used INTEGER,
    vehicles_rented INTEGER,
    
    -- Optimizer parametreleri (o anki değerler)
    cost_per_km DECIMAL(10, 2),
    rental_cost DECIMAL(10, 2),
    
    optimizer_result JSONB,             -- Tam optimizer çıktısı
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_plans_date ON plans(plan_date);
CREATE INDEX idx_plans_status ON plans(status);

-- ============================================================
-- PLAN ROUTES (Her araç için rota detayı)
-- ============================================================

CREATE TABLE plan_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    
    route_order INTEGER NOT NULL,       -- Araç sırası (1, 2, 3...)
    
    -- Rota istatistikleri
    total_distance_km DECIMAL(10, 3) NOT NULL,
    total_duration_minutes DECIMAL(10, 2),
    total_cost DECIMAL(10, 2) NOT NULL,
    total_weight_kg DECIMAL(10, 2) NOT NULL,
    cargo_count INTEGER NOT NULL,
    
    -- Rota detayı
    route_stations UUID[] NOT NULL,     -- İstasyon ID'leri sırayla
    route_polyline TEXT,                -- Tüm rotanın birleşik polyline'ı
    route_details JSONB,                -- Detaylı segment bilgisi
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_plan_routes_plan ON plan_routes(plan_id);
CREATE INDEX idx_plan_routes_vehicle ON plan_routes(vehicle_id);

-- ============================================================
-- PLAN ROUTE CARGOS (Hangi rota hangi kargoları taşıyor)
-- ============================================================

CREATE TABLE plan_route_cargos (
    id SERIAL PRIMARY KEY,
    plan_route_id UUID NOT NULL REFERENCES plan_routes(id) ON DELETE CASCADE,
    cargo_id UUID NOT NULL REFERENCES cargos(id),
    pickup_order INTEGER NOT NULL,      -- Kaçıncı sırada alınacak
    UNIQUE(plan_route_id, cargo_id)
);

CREATE INDEX idx_prc_route ON plan_route_cargos(plan_route_id);
CREATE INDEX idx_prc_cargo ON plan_route_cargos(cargo_id);

-- ============================================================
-- TRIPS (Gerçekleşen seferler - anlık kayıt)
-- ============================================================

CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_route_id UUID REFERENCES plan_routes(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    actual_distance_km DECIMAL(10, 3),
    actual_duration_minutes DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_dates ON trips(started_at, completed_at);

-- ============================================================
-- TRIP LOGS (Sefer anlık konum/durum logları)
-- ============================================================

CREATE TABLE trip_logs (
    id SERIAL PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    station_id UUID REFERENCES stations(id),
    event_type VARCHAR(50) NOT NULL,    -- 'departed', 'arrived', 'loading', 'unloading'
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_trip_logs_trip ON trip_logs(trip_id);

-- ============================================================
-- VIEWS (Kolaylık için)
-- ============================================================

-- Günlük istasyon kargo özeti (ertesi gün planlaması için)
CREATE VIEW v_daily_station_summary AS
SELECT 
    c.scheduled_date,
    s.id AS station_id,
    s.name AS station_name,
    s.code AS station_code,
    s.latitude,
    s.longitude,
    COUNT(c.id) AS cargo_count,
    COALESCE(SUM(c.weight_kg), 0) AS total_weight_kg
FROM stations s
LEFT JOIN cargos c ON c.origin_station_id = s.id 
    AND c.status = 'pending'
    AND c.scheduled_date IS NOT NULL
WHERE s.is_active = true
GROUP BY c.scheduled_date, s.id, s.name, s.code, s.latitude, s.longitude;

-- Aktif araçlar ve durumları
CREATE VIEW v_vehicle_status AS
SELECT 
    v.*,
    pr.plan_id,
    p.plan_date,
    pr.total_distance_km AS assigned_distance,
    pr.cargo_count AS assigned_cargos
FROM vehicles v
LEFT JOIN plan_routes pr ON pr.vehicle_id = v.id
LEFT JOIN plans p ON p.id = pr.plan_id AND p.status = 'active'
WHERE v.is_active = true;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Tracking code generator
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := 'KRG-';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Auto-set tracking code on cargo insert
CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
        NEW.tracking_code := generate_tracking_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cargo_tracking_code
    BEFORE INSERT ON cargos
    FOR EACH ROW
    EXECUTE FUNCTION set_tracking_code();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_stations_updated BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_cargos_updated BEFORE UPDATE ON cargos FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Set station location from lat/long
CREATE OR REPLACE FUNCTION set_station_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_station_location
    BEFORE INSERT OR UPDATE ON stations
    FOR EACH ROW
    EXECUTE FUNCTION set_station_location();

-- ============================================================
-- GRANTS (İzinler)
-- ============================================================

-- Uygulama kullanıcısı için (production'da ayrı user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kargo_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kargo_app;
