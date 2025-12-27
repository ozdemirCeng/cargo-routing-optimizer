-- ============================================================
-- KARGO İŞLETME SİSTEMİ (Supabase / PostgreSQL)
-- "Company-grade" tek parça migration + seed
-- ============================================================

BEGIN;

-- ----------------------------
-- Extensions (Supabase uyumlu)
-- ----------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis;    -- geography(point)
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ----------------------------
-- ENUM TYPES
-- ----------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cargo_status AS ENUM ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('available', 'on_route', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE plan_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_ownership AS ENUM ('owned', 'rented');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE problem_type AS ENUM (
      'unlimited_vehicles',
      'limited_vehicles',
      'limited_vehicles_max_count',
      'limited_vehicles_max_weight'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE trip_event_type AS ENUM ('departed', 'arrived', 'loading', 'unloading', 'status_change', 'note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM ('insert', 'update', 'delete', 'login', 'logout', 'plan_generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------
-- CORE: Organizations (Multi-tenant)
-- ----------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_active ON organizations(is_active);

-- ----------------------------
-- USERS (Uygulama kullanıcıları)
-- Not: Supabase auth kullanacaksan password_hash tutmak yerine auth.users ile ilişkilendirirsin.
-- ----------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email         CITEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'user',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_app_users_org ON app_users(org_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- ----------------------------
-- SYSTEM PARAMETERS (org bazlı)
-- ----------------------------
CREATE TABLE IF NOT EXISTS system_parameters (
    id          BIGSERIAL PRIMARY KEY,
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    param_key   TEXT NOT NULL,
    param_value JSONB NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES app_users(id),
    UNIQUE (org_id, param_key)
);

CREATE INDEX IF NOT EXISTS idx_params_org ON system_parameters(org_id);
CREATE INDEX IF NOT EXISTS idx_params_key ON system_parameters(param_key);

-- ----------------------------
-- STATIONS
-- ----------------------------
CREATE TABLE IF NOT EXISTS stations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    latitude    NUMERIC(10, 8) NOT NULL,
    longitude   NUMERIC(11, 8) NOT NULL,
    location    GEOGRAPHY(POINT, 4326),
    address     TEXT,
    is_hub      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES app_users(id),
    UNIQUE (org_id, code),
    CONSTRAINT chk_station_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_station_lng CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_stations_org ON stations(org_id);
CREATE INDEX IF NOT EXISTS idx_stations_code ON stations(code);
CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST(location);

-- ----------------------------
-- VEHICLES
-- ----------------------------
CREATE TABLE IF NOT EXISTS vehicles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plate_number     TEXT NOT NULL,
    name             TEXT NOT NULL,
    capacity_kg      NUMERIC(10, 2) NOT NULL,
    fuel_consumption NUMERIC(6, 3) NOT NULL DEFAULT 0.100, -- lt/km
    ownership        vehicle_ownership NOT NULL DEFAULT 'owned',
    rental_cost      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status           vehicle_status NOT NULL DEFAULT 'available',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, plate_number),
    CONSTRAINT chk_vehicle_capacity CHECK (capacity_kg > 0),
    CONSTRAINT chk_vehicle_fuel CHECK (fuel_consumption >= 0),
    CONSTRAINT chk_vehicle_rental_cost CHECK (rental_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_org ON vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_capacity ON vehicles(capacity_kg);

-- ----------------------------
-- CARGOS
-- ----------------------------
CREATE TABLE IF NOT EXISTS cargos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tracking_code          TEXT NOT NULL,
    user_id                UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    origin_station_id      UUID NOT NULL REFERENCES stations(id),
    destination_station_id UUID REFERENCES stations(id),
    weight_kg              NUMERIC(10, 2) NOT NULL,
    description            TEXT,
    status                 cargo_status NOT NULL DEFAULT 'pending',
    scheduled_date         DATE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, tracking_code),
    CONSTRAINT chk_cargo_weight CHECK (weight_kg > 0),
    CONSTRAINT chk_cargo_origin_dest CHECK (
        destination_station_id IS NULL OR origin_station_id <> destination_station_id
    )
);

CREATE INDEX IF NOT EXISTS idx_cargos_org ON cargos(org_id);
CREATE INDEX IF NOT EXISTS idx_cargos_user ON cargos(user_id);
CREATE INDEX IF NOT EXISTS idx_cargos_status ON cargos(status);
CREATE INDEX IF NOT EXISTS idx_cargos_origin ON cargos(origin_station_id);
CREATE INDEX IF NOT EXISTS idx_cargos_scheduled ON cargos(scheduled_date);

-- ----------------------------
-- DISTANCE MATRIX (cache)
-- profile: 'car', 'truck', vs.
-- ----------------------------
CREATE TABLE IF NOT EXISTS distance_matrix (
    id               BIGSERIAL PRIMARY KEY,
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_station_id  UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    to_station_id    UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    profile          TEXT NOT NULL DEFAULT 'car',
    distance_km      NUMERIC(10, 3) NOT NULL,
    duration_minutes NUMERIC(10, 2) NOT NULL,
    polyline         TEXT,
    calculated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, from_station_id, to_station_id, profile),
    CONSTRAINT chk_dm_dist CHECK (distance_km >= 0),
    CONSTRAINT chk_dm_dur CHECK (duration_minutes >= 0),
    CONSTRAINT chk_dm_from_to CHECK (from_station_id <> to_station_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_org ON distance_matrix(org_id);
CREATE INDEX IF NOT EXISTS idx_dm_from ON distance_matrix(from_station_id);
CREATE INDEX IF NOT EXISTS idx_dm_to ON distance_matrix(to_station_id);

-- ----------------------------
-- PLANS
-- ----------------------------
CREATE TABLE IF NOT EXISTS plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_date         DATE NOT NULL,
    problem_type      problem_type NOT NULL,
    status            plan_status NOT NULL DEFAULT 'draft',

    total_distance_km NUMERIC(10, 3),
    total_cost        NUMERIC(10, 2),
    total_cargos      INTEGER,
    total_weight_kg   NUMERIC(10, 2),
    vehicles_used     INTEGER,
    vehicles_rented   INTEGER,

    -- Parametre snapshot (o an kullanılan değerler)
    params_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,

    optimizer_result  JSONB,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES app_users(id),

    CONSTRAINT chk_plan_counts CHECK (
        (total_cargos IS NULL OR total_cargos >= 0) AND
        (vehicles_used IS NULL OR vehicles_used >= 0) AND
        (vehicles_rented IS NULL OR vehicles_rented >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_plans_org ON plans(org_id);
CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);

-- ----------------------------
-- PLAN ROUTES
-- ----------------------------
CREATE TABLE IF NOT EXISTS plan_routes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id                UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    vehicle_id             UUID NOT NULL REFERENCES vehicles(id),

    route_order            INTEGER NOT NULL,

    total_distance_km      NUMERIC(10, 3) NOT NULL,
    total_duration_minutes NUMERIC(10, 2),
    total_cost             NUMERIC(10, 2) NOT NULL,
    total_weight_kg        NUMERIC(10, 2) NOT NULL,
    cargo_count            INTEGER NOT NULL,

    -- Opsiyonel (geriye uyumluluk): hızlı göstermek için dizi
    route_stations         UUID[],

    route_polyline         TEXT,
    route_details          JSONB,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_pr_order CHECK (route_order > 0),
    CONSTRAINT chk_pr_stats CHECK (
        total_distance_km >= 0 AND total_cost >= 0 AND total_weight_kg >= 0 AND cargo_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_plan_routes_org ON plan_routes(org_id);
CREATE INDEX IF NOT EXISTS idx_plan_routes_plan ON plan_routes(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_routes_vehicle ON plan_routes(vehicle_id);

-- ----------------------------
-- PLAN ROUTE STOPS (kurumsal normalize rota adımları)
-- ----------------------------
CREATE TABLE IF NOT EXISTS plan_route_stops (
    id                  BIGSERIAL PRIMARY KEY,
    plan_route_id        UUID NOT NULL REFERENCES plan_routes(id) ON DELETE CASCADE,
    stop_order           INTEGER NOT NULL,
    station_id           UUID NOT NULL REFERENCES stations(id),
    segment_distance_km  NUMERIC(10, 3),
    segment_duration_min NUMERIC(10, 2),
    segment_polyline     TEXT,
    eta_time             TIMESTAMPTZ,
    UNIQUE (plan_route_id, stop_order),
    CONSTRAINT chk_prs_order CHECK (stop_order > 0)
);

CREATE INDEX IF NOT EXISTS idx_prs_route ON plan_route_stops(plan_route_id);
CREATE INDEX IF NOT EXISTS idx_prs_station ON plan_route_stops(station_id);

-- ----------------------------
-- PLAN ROUTE CARGOS
-- ----------------------------
CREATE TABLE IF NOT EXISTS plan_route_cargos (
    id            BIGSERIAL PRIMARY KEY,
    plan_route_id UUID NOT NULL REFERENCES plan_routes(id) ON DELETE CASCADE,
    cargo_id      UUID NOT NULL REFERENCES cargos(id),
    pickup_order  INTEGER NOT NULL,
    UNIQUE (plan_route_id, cargo_id),
    CONSTRAINT chk_pickup_order CHECK (pickup_order > 0)
);

CREATE INDEX IF NOT EXISTS idx_prc_route ON plan_route_cargos(plan_route_id);
CREATE INDEX IF NOT EXISTS idx_prc_cargo ON plan_route_cargos(cargo_id);

-- ----------------------------
-- TRIPS (gerçek sefer)
-- ----------------------------
CREATE TABLE IF NOT EXISTS trips (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_route_id           UUID REFERENCES plan_routes(id),
    vehicle_id              UUID NOT NULL REFERENCES vehicles(id),

    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,

    actual_distance_km      NUMERIC(10, 3),
    actual_duration_minutes NUMERIC(10, 2),
    actual_cost             NUMERIC(10, 2),

    status                  trip_status NOT NULL DEFAULT 'scheduled',
    notes                   TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_trip_times CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    )
);

CREATE INDEX IF NOT EXISTS idx_trips_org ON trips(org_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(started_at, completed_at);

-- ----------------------------
-- TRIP LOGS
-- ----------------------------
CREATE TABLE IF NOT EXISTS trip_logs (
    id         BIGSERIAL PRIMARY KEY,
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    station_id UUID REFERENCES stations(id),
    event_type trip_event_type NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_org ON trip_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_trip ON trip_logs(trip_id);

-- ----------------------------
-- AUDIT LOGS (kim ne yaptı)
-- ----------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id            BIGSERIAL PRIMARY KEY,
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id  UUID REFERENCES app_users(id),
    action         audit_action NOT NULL,
    entity_table   TEXT,
    entity_id      UUID,
    before_json    JSONB,
    after_json     JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_id     TEXT,
    ip_address     INET
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- 1) Updated_at trigger (FIX: :=)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_updated ON organizations;
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated ON app_users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_stations_updated ON stations;
CREATE TRIGGER trg_stations_updated BEFORE UPDATE ON stations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated ON vehicles;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cargos_updated ON cargos;
CREATE TRIGGER trg_cargos_updated BEFORE UPDATE ON cargos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_trips_updated ON trips;
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) Station location from lat/long
CREATE OR REPLACE FUNCTION set_station_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_station_location ON stations;
CREATE TRIGGER trg_station_location
BEFORE INSERT OR UPDATE ON stations
FOR EACH ROW EXECUTE FUNCTION set_station_location();

-- 3) Tracking code generator
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
    -- 8 char base32-ish
    raw BYTEA;
    code TEXT;
BEGIN
    raw := gen_random_bytes(6); -- 48 bit ~ yeter
    code := upper(encode(raw, 'hex')); -- 12 hex char
    RETURN 'KRG-' || substr(code, 1, 8);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
        NEW.tracking_code := generate_tracking_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cargo_tracking_code ON cargos;
CREATE TRIGGER trg_cargo_tracking_code
BEFORE INSERT ON cargos
FOR EACH ROW EXECUTE FUNCTION set_tracking_code();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_daily_station_summary AS
SELECT
    c.org_id,
    c.scheduled_date,
    s.id AS station_id,
    s.name AS station_name,
    s.code AS station_code,
    s.latitude,
    s.longitude,
    COUNT(c.id) AS cargo_count,
    COALESCE(SUM(c.weight_kg), 0) AS total_weight_kg
FROM stations s
LEFT JOIN cargos c
    ON c.origin_station_id = s.id
   AND c.status = 'pending'
   AND c.scheduled_date IS NOT NULL
WHERE s.is_active = TRUE
GROUP BY c.org_id, c.scheduled_date, s.id, s.name, s.code, s.latitude, s.longitude;

CREATE OR REPLACE VIEW v_vehicle_status AS
SELECT
    v.*,
    pr.plan_id,
    p.plan_date,
    pr.total_distance_km AS assigned_distance,
    pr.cargo_count AS assigned_cargos
FROM vehicles v
LEFT JOIN plan_routes pr ON pr.vehicle_id = v.id
LEFT JOIN plans p ON p.id = pr.plan_id AND p.status = 'active'
WHERE v.is_active = TRUE;

-- ============================================================
-- SEED DATA (tek org + admin + Kocaeli istasyonları + 3 araç + params)
-- Not: password_hash placeholder; production'da gerçek hash koy.
-- ============================================================

-- Default org
INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Kargo Demo Org', 'kargo-demo')
ON CONFLICT (slug) DO NOTHING;

-- Admin user (şifre hash'i örnek/placeholder)
INSERT INTO app_users (id, org_id, email, password_hash, full_name, role)
VALUES
('00000000-0000-0000-0000-000000000001',
 '11111111-1111-1111-1111-111111111111',
 'admin@kargo.local',
 '$2b$10$REPLACE_WITH_REAL_BCRYPT_HASH___________________________',
 'Sistem Yöneticisi',
 'admin')
ON CONFLICT (org_id, email) DO NOTHING;

-- System parameters (JSONB)
INSERT INTO system_parameters (org_id, param_key, param_value, description, updated_by)
VALUES
('11111111-1111-1111-1111-111111111111', 'cost_per_km',        '1.00'::jsonb,  'Kilometre başına maliyet (birim)', '00000000-0000-0000-0000-000000000001'),
('11111111-1111-1111-1111-111111111111', 'rental_cost_500kg',  '200.00'::jsonb, '500 kg kapasiteli kiralık araç maliyeti', '00000000-0000-0000-0000-000000000001'),
('11111111-1111-1111-1111-111111111111', 'default_fuel_consumption', '0.10'::jsonb, 'Varsayılan yakıt tüketimi (lt/km)', '00000000-0000-0000-0000-000000000001'),
('11111111-1111-1111-1111-111111111111', 'average_speed_kmh',  '50.00'::jsonb, 'Ortalama araç hızı (km/saat)', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (org_id, param_key) DO NOTHING;

-- Stations (Kocaeli)
INSERT INTO stations (id, org_id, name, code, latitude, longitude, is_hub, is_active, created_by)
VALUES
('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Kocaeli Üniversitesi (Merkez Hub)', 'HUB', 40.8224, 29.9256, TRUE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Başiskele', 'BASISKELE', 40.7167, 29.9333, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Çayırova', 'CAYIROVA', 40.8275, 29.3772, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Darıca', 'DARICA', 40.7692, 29.3753, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Derince', 'DERINCE', 40.7550, 29.8267, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Dilovası', 'DILOVASI', 40.7833, 29.5333, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Gebze', 'GEBZE', 40.8028, 29.4306, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Gölcük', 'GOLCUK', 40.7167, 29.8167, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Kandıra', 'KANDIRA', 41.0711, 30.1528, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Karamürsel', 'KARAMURSEL', 40.6917, 29.6167, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Kartepe', 'KARTEPE', 40.7500, 30.0333, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Körfez', 'KORFEZ', 40.7833, 29.7333, FALSE, TRUE, '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'İzmit', 'IZMIT', 40.7667, 29.9167, FALSE, TRUE, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (org_id, code) DO NOTHING;

-- Vehicles (3 owned)
INSERT INTO vehicles (id, org_id, plate_number, name, capacity_kg, ownership, rental_cost, status)
VALUES
('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '41 KRG 001', 'Araç 1 (500 kg)', 500.00, 'owned', 0, 'available'),
('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '41 KRG 002', 'Araç 2 (750 kg)', 750.00, 'owned', 0, 'available'),
('20000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '41 KRG 003', 'Araç 3 (1000 kg)', 1000.00, 'owned', 0, 'available')
ON CONFLICT (org_id, plate_number) DO NOTHING;

COMMIT;

-- ============================================================
-- SUPABASE RBAC + RLS (Company-grade)
-- Çalıştırmadan önce: şema tabloların (organizations, app_users, cargos, plan_routes...) mevcut olmalı
-- ============================================================

BEGIN;

-- ----------------------------
-- (Opsiyonel) Placeholder seed user'ları temizle (Auth ile çakışmasın)
-- ----------------------------
DELETE FROM public.app_users
WHERE email IN ('admin@kargo.local', 'ali@kargo.local', 'ayse@kargo.local', 'mehmet@kargo.local')
  AND password_hash LIKE '%REPLACE%';

-- ----------------------------
-- Helper functions (RLS için)
-- ----------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.app_users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = 'admin'
  );
$$;

-- Kullanıcı bu rota'yı görebilir mi? (admin veya rota içindeki kendi kargosu)
CREATE OR REPLACE FUNCTION public.can_view_route(route_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.plan_route_cargos prc
      JOIN public.cargos c      ON c.id = prc.cargo_id
      JOIN public.plan_routes pr ON pr.id = prc.plan_route_id
      WHERE pr.id = route_id
        AND pr.org_id = public.current_org_id()
        AND c.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_plan(plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.plan_routes pr
      JOIN public.plan_route_cargos prc ON prc.plan_route_id = pr.id
      JOIN public.cargos c              ON c.id = prc.cargo_id
      WHERE pr.plan_id = plan_id
        AND pr.org_id = public.current_org_id()
        AND c.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_trip(trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      JOIN public.plan_routes pr        ON pr.id = t.plan_route_id
      JOIN public.plan_route_cargos prc ON prc.plan_route_id = pr.id
      JOIN public.cargos c              ON c.id = prc.cargo_id
      WHERE t.id = trip_id
        AND t.org_id = public.current_org_id()
        AND c.user_id = auth.uid()
    );
$$;

-- ----------------------------
-- Auth -> app_users otomatik profil oluşturma
-- (Yeni user signup olunca app_users'a düşer)
-- ----------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org uuid;
  display_name text;
BEGIN
  SELECT id INTO default_org
  FROM public.organizations
  WHERE slug = 'kargo-demo'
  LIMIT 1;

  IF default_org IS NULL THEN
    INSERT INTO public.organizations(name, slug)
    VALUES ('Kargo Demo Org', 'kargo-demo')
    RETURNING id INTO default_org;
  END IF;

  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.app_users (id, org_id, email, password_hash, full_name, role, is_active)
  VALUES (NEW.id, default_org, NEW.email, 'SUPABASE_AUTH', display_name, 'user', true)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------
-- GRANTS (Supabase roller)
-- ----------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- tablolar
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- sequence'ler (bigserial için)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ----------------------------
-- RLS Enable
-- ----------------------------
ALTER TABLE IF EXISTS public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cargos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.distance_matrix   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_routes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_route_stops  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_route_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trip_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs        ENABLE ROW LEVEL SECURITY;

-- ----------------------------
-- POLICIES (service_role full)
-- ----------------------------
DO $$ BEGIN
  CREATE POLICY "service_role_all_orgs" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_app_users" ON public.app_users FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_params" ON public.system_parameters FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_stations" ON public.stations FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_vehicles" ON public.vehicles FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_cargos" ON public.cargos FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_distance" ON public.distance_matrix FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_plans" ON public.plans FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_plan_routes" ON public.plan_routes FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_route_stops" ON public.plan_route_stops FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_route_cargos" ON public.plan_route_cargos FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_trips" ON public.trips FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_trip_logs" ON public.trip_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_audit" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------
-- POLICIES (authenticated)
-- Org izolasyonu + RBAC
-- ----------------------------

-- organizations: user kendi org’unu görür; sadece admin update
DO $$ BEGIN
  CREATE POLICY "org_select_own" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.is_admin())
  WITH CHECK (id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- app_users: user kendi profilini görür; admin org içindekileri görür/yönetir
DO $$ BEGIN
  CREATE POLICY "users_select_self_or_admin" ON public.app_users
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (id = auth.uid() OR public.is_admin()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_update_self" ON public.app_users
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_update_admin" ON public.app_users
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- system_parameters: herkes okuyabilir; sadece admin değiştirir
DO $$ BEGIN
  CREATE POLICY "params_select_org" ON public.system_parameters
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "params_write_admin" ON public.system_parameters
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "params_update_admin" ON public.system_parameters
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "params_delete_admin" ON public.system_parameters
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- stations: herkes okuyabilir; sadece admin CRUD
DO $$ BEGIN
  CREATE POLICY "stations_select_org" ON public.stations
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stations_insert_admin" ON public.stations
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stations_update_admin" ON public.stations
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stations_delete_admin" ON public.stations
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vehicles: herkes okuyabilir; sadece admin CRUD
DO $$ BEGIN
  CREATE POLICY "vehicles_select_org" ON public.vehicles
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vehicles_write_admin" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vehicles_update_admin" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vehicles_delete_admin" ON public.vehicles
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- cargos: user sadece kendi kargolarını görür; admin tüm org görür
DO $$ BEGIN
  CREATE POLICY "cargos_select_own_or_admin" ON public.cargos
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.is_admin()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user kargo oluşturabilir (kendi adına); admin de oluşturabilir
DO $$ BEGIN
  CREATE POLICY "cargos_insert_own_or_admin" ON public.cargos
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      (user_id = auth.uid())
      OR public.is_admin()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user sadece pending iken update edebilsin (iptal dahil); admin her zaman
DO $$ BEGIN
  CREATE POLICY "cargos_update_user_pending" ON public.cargos
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
    AND status IN ('pending', 'cancelled')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cargos_update_admin" ON public.cargos
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cargos_delete_admin" ON public.cargos
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- distance_matrix: herkes okuyabilir; yazma admin (veya service_role zaten var)
DO $$ BEGIN
  CREATE POLICY "dm_select_org" ON public.distance_matrix
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dm_write_admin" ON public.distance_matrix
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dm_update_admin" ON public.distance_matrix
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plans: admin tümünü görür; user sadece kendi kargosu bulunan planları görür
DO $$ BEGIN
  CREATE POLICY "plans_select_admin_or_related" ON public.plans
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.can_view_plan(id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "plans_write_admin" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "plans_update_admin" ON public.plans
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plan_routes: admin tümünü; user sadece kendi kargosunu taşıyan route'u görür
DO $$ BEGIN
  CREATE POLICY "routes_select_admin_or_related" ON public.plan_routes
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.can_view_route(id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "routes_write_admin" ON public.plan_routes
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "routes_update_admin" ON public.plan_routes
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plan_route_stops: user route'u görebiliyorsa stop'ları da görür; yazma admin
DO $$ BEGIN
  CREATE POLICY "stops_select_if_can_view_route" ON public.plan_route_stops
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.plan_routes pr
      WHERE pr.id = plan_route_id
        AND pr.org_id = public.current_org_id()
        AND public.can_view_route(pr.id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stops_write_admin" ON public.plan_route_stops
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plan_routes pr
      WHERE pr.id = plan_route_id
        AND pr.org_id = public.current_org_id()
        AND public.is_admin()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stops_update_admin" ON public.plan_route_stops
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.plan_routes pr
      WHERE pr.id = plan_route_id
        AND pr.org_id = public.current_org_id()
        AND public.is_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plan_routes pr
      WHERE pr.id = plan_route_id
        AND pr.org_id = public.current_org_id()
        AND public.is_admin()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plan_route_cargos: user sadece kendi cargo satırını görebilir; admin tümünü
DO $$ BEGIN
  CREATE POLICY "prc_select_own_or_admin" ON public.plan_route_cargos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.plan_routes pr
      JOIN public.cargos c ON c.id = cargo_id
      WHERE pr.id = plan_route_id
        AND pr.org_id = public.current_org_id()
        AND (public.is_admin() OR c.user_id = auth.uid())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prc_write_admin" ON public.plan_route_cargos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plan_routes pr
      WHERE pr.id = plan_route_id
        AND pr.org_id = public.current_org_id()
        AND public.is_admin()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- trips: admin tüm; user sadece kendi kargosu olan trip
DO $$ BEGIN
  CREATE POLICY "trips_select_admin_or_related" ON public.trips
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_trip(id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "trips_write_admin" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "trips_update_admin" ON public.trips
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- trip_logs: user trip'i görebiliyorsa log'u görür; yazma admin
DO $$ BEGIN
  CREATE POLICY "trip_logs_select_related" ON public.trip_logs
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.can_view_trip(trip_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "trip_logs_write_admin" ON public.trip_logs
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_logs: sadece admin okuyabilir (yazma genelde backend/service_role)
DO $$ BEGIN
  CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
-- ============================================================
-- AUDIT TRIGGERS + SIKILAŞTIRILMIŞ USER UPDATE (Company-grade)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Audit helper: current user + request metadata
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_write(
  p_org_id uuid,
  p_action public.audit_action,
  p_entity_table text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  INSERT INTO public.audit_logs(org_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES (p_org_id, v_actor, p_action, p_entity_table, p_entity_id, p_before, p_after);
END;
$$;

-- ------------------------------------------------------------
-- 2) Generic audit trigger (INSERT/UPDATE/DELETE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_row_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_action public.audit_action;
  v_entity uuid;
  v_before jsonb;
  v_after  jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_org := NEW.org_id;
    v_entity := NEW.id;
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_org := NEW.org_id;
    v_entity := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_org := OLD.org_id;
    v_entity := OLD.id;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  PERFORM public.audit_write(v_org, v_action, TG_TABLE_NAME, v_entity, v_before, v_after);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3) Attach audit triggers (kritik tablolar)
-- Not: Çok gürültü olmasın diye hepsine takmıyoruz. İstersen ekleriz.
-- ------------------------------------------------------------

-- cargos
DROP TRIGGER IF EXISTS trg_audit_cargos ON public.cargos;
CREATE TRIGGER trg_audit_cargos
AFTER INSERT OR UPDATE OR DELETE ON public.cargos
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- plans
DROP TRIGGER IF EXISTS trg_audit_plans ON public.plans;
CREATE TRIGGER trg_audit_plans
AFTER INSERT OR UPDATE OR DELETE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- plan_routes
DROP TRIGGER IF EXISTS trg_audit_plan_routes ON public.plan_routes;
CREATE TRIGGER trg_audit_plan_routes
AFTER INSERT OR UPDATE OR DELETE ON public.plan_routes
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- trips
DROP TRIGGER IF EXISTS trg_audit_trips ON public.trips;
CREATE TRIGGER trg_audit_trips
AFTER INSERT OR UPDATE OR DELETE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- stations (admin değişiklikleri önemli)
DROP TRIGGER IF EXISTS trg_audit_stations ON public.stations;
CREATE TRIGGER trg_audit_stations
AFTER INSERT OR UPDATE OR DELETE ON public.stations
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- vehicles
DROP TRIGGER IF EXISTS trg_audit_vehicles ON public.vehicles;
CREATE TRIGGER trg_audit_vehicles
AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- system_parameters
DROP TRIGGER IF EXISTS trg_audit_params ON public.system_parameters;
CREATE TRIGGER trg_audit_params
AFTER INSERT OR UPDATE OR DELETE ON public.system_parameters
FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- ------------------------------------------------------------
-- 4) Special event: plan_generated (optimizer plan ürettiğinde)
-- Backend / optimizer planı 'active' yapınca plan_generated yazalım
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_plan_generated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- draft -> active geçişi "plan_generated" say
  IF (OLD.status IS DISTINCT FROM NEW.status) AND OLD.status = 'draft' AND NEW.status = 'active' THEN
    PERFORM public.audit_write(
      NEW.org_id,
      'plan_generated',
      'plans',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_generated ON public.plans;
CREATE TRIGGER trg_plan_generated
AFTER UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.audit_plan_generated();

-- ------------------------------------------------------------
-- 5) Sıkı user update guard: kullanıcı kargoda sadece belli alanları değiştirebilsin
-- - Sadece pending iken
-- - Allowed changes: description, scheduled_date, status -> cancelled
-- - Disallowed: weight_kg, origin_station_id, destination_station_id, user_id, tracking_code, org_id
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_cargo_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin ise karışma
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- User sadece kendi kaydı ve pending iken update edebilir; RLS zaten bunu kısmen sağlıyor
  -- burada alan bazlı sıkılaştırıyoruz.
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Cargo cannot be modified unless status=pending';
  END IF;

  -- org/user/tracking değişemez
  IF NEW.org_id <> OLD.org_id THEN
    RAISE EXCEPTION 'org_id cannot be changed';
  END IF;

  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;

  IF NEW.tracking_code <> OLD.tracking_code THEN
    RAISE EXCEPTION 'tracking_code cannot be changed';
  END IF;

  -- istasyon/weight değişemez
  IF NEW.origin_station_id <> OLD.origin_station_id THEN
    RAISE EXCEPTION 'origin_station_id cannot be changed';
  END IF;

  IF COALESCE(NEW.destination_station_id, '00000000-0000-0000-0000-000000000000'::uuid)
     <> COALESCE(OLD.destination_station_id, '00000000-0000-0000-0000-000000000000'::uuid)
  THEN
    RAISE EXCEPTION 'destination_station_id cannot be changed';
  END IF;

  IF NEW.weight_kg <> OLD.weight_kg THEN
    RAISE EXCEPTION 'weight_kg cannot be changed';
  END IF;

  -- status sadece pending -> cancelled olabilir (user tarafı)
  IF NEW.status <> OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'Only pending -> cancelled is allowed for users';
    END IF;
  END IF;

  -- description ve scheduled_date serbest (pending iken)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_cargo_update ON public.cargos;
CREATE TRIGGER trg_guard_user_cargo_update
BEFORE UPDATE ON public.cargos
FOR EACH ROW EXECUTE FUNCTION public.guard_user_cargo_update();

COMMIT;
begin;

-- 0) organizations tablon sende slug NOT NULL olabilir -> Demo Org'u slug ile garantiye al
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='organizations' and column_name='slug'
  ) then
    -- önce varsa null slug'u düzelt
    update public.organizations
      set slug = 'demo-org'
    where id = '11111111-1111-1111-1111-111111111111'::uuid
      and (slug is null or slug = '');

    insert into public.organizations (id, name, slug)
    values ('11111111-1111-1111-1111-111111111111'::uuid, 'Demo Org', 'demo-org')
    on conflict (id) do update
      set name = excluded.name,
          slug = coalesce(public.organizations.slug, excluded.slug);
  else
    insert into public.organizations (id, name)
    values ('11111111-1111-1111-1111-111111111111'::uuid, 'Demo Org')
    on conflict (id) do update
      set name = excluded.name;
  end if;
end $$;

-- 1) app_users tablosuna org_id ve eksik alanları ekle
alter table public.app_users
  add column if not exists org_id uuid;

update public.app_users
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;

alter table public.app_users
  alter column org_id set not null;

do $$ begin
  alter table public.app_users
    add constraint app_users_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- app_users.role yoksa ekle (type zaten var diye varsayıyorum; yoksa senin script oluşturuyor)
alter table public.app_users
  add column if not exists role public.user_role not null default 'user';

alter table public.app_users
  add column if not exists is_active boolean not null default true;

-- 2) Domain tablolarına org_id ekle / doldur / FK ekle
-- system_parameters
alter table public.system_parameters add column if not exists org_id uuid;
update public.system_parameters
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.system_parameters alter column org_id set not null;

do $$ begin
  alter table public.system_parameters
    add constraint system_parameters_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- created_by / updated_by FK'lerini SET NULL yap (sende eski constraint farklı olabilir)
alter table public.system_parameters
  drop constraint if exists system_parameters_updated_by_fkey;
alter table public.system_parameters
  add constraint system_parameters_updated_by_fkey
  foreign key (updated_by) references public.app_users(id) on delete set null;

-- stations
alter table public.stations add column if not exists org_id uuid;
update public.stations
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.stations alter column org_id set not null;

do $$ begin
  alter table public.stations
    add constraint stations_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

alter table public.stations
  drop constraint if exists stations_created_by_fkey;
alter table public.stations
  add constraint stations_created_by_fkey
  foreign key (created_by) references public.app_users(id) on delete set null;

-- vehicles
alter table public.vehicles add column if not exists org_id uuid;
update public.vehicles
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.vehicles alter column org_id set not null;

do $$ begin
  alter table public.vehicles
    add constraint vehicles_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- cargos
alter table public.cargos add column if not exists org_id uuid;
update public.cargos
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.cargos alter column org_id set not null;

do $$ begin
  alter table public.cargos
    add constraint cargos_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- distance_matrix
alter table public.distance_matrix add column if not exists org_id uuid;
update public.distance_matrix
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.distance_matrix alter column org_id set not null;

do $$ begin
  alter table public.distance_matrix
    add constraint distance_matrix_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- plans
alter table public.plans add column if not exists org_id uuid;
update public.plans
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.plans alter column org_id set not null;

do $$ begin
  alter table public.plans
    add constraint plans_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

alter table public.plans
  drop constraint if exists plans_created_by_fkey;
alter table public.plans
  add constraint plans_created_by_fkey
  foreign key (created_by) references public.app_users(id) on delete set null;

-- plan_routes
alter table public.plan_routes add column if not exists org_id uuid;
update public.plan_routes
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.plan_routes alter column org_id set not null;

do $$ begin
  alter table public.plan_routes
    add constraint plan_routes_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- plan_route_cargos
alter table public.plan_route_cargos add column if not exists org_id uuid;
update public.plan_route_cargos
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.plan_route_cargos alter column org_id set not null;

do $$ begin
  alter table public.plan_route_cargos
    add constraint plan_route_cargos_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- trips
alter table public.trips add column if not exists org_id uuid;
update public.trips
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.trips alter column org_id set not null;

do $$ begin
  alter table public.trips
    add constraint trips_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- trip_logs
alter table public.trip_logs add column if not exists org_id uuid;
update public.trip_logs
set org_id = '11111111-1111-1111-1111-111111111111'::uuid
where org_id is null;
alter table public.trip_logs alter column org_id set not null;

do $$ begin
  alter table public.trip_logs
    add constraint trip_logs_org_id_fkey
    foreign key (org_id) references public.organizations(id) on delete restrict;
exception when duplicate_object then null; end $$;

commit;
begin;

do $$
declare coltype text;
begin
  select udt_name into coltype
  from information_schema.columns
  where table_schema='public'
    and table_name='system_parameters'
    and column_name='param_value';

  -- Sadece jsonb ise dönüştür
  if coltype = 'jsonb' then
    execute 'alter table public.system_parameters alter column param_value drop default';
    execute 'alter table public.system_parameters alter column param_value drop not null';

    execute $sql$
      alter table public.system_parameters
        alter column param_value type numeric(10,2)
        using (
          case jsonb_typeof(param_value)
            when 'number' then (param_value::text)::numeric
            when 'string' then nullif(trim(both '"' from param_value::text), '')::numeric
            else null
          end
        )
    $sql$;

    execute 'update public.system_parameters set param_value = 0 where param_value is null';
    execute 'alter table public.system_parameters alter column param_value set not null';
  end if;
end $$;

commit;
begin;

-- audit_logs'a entity_key ekle (uuid olmayan id'ler için)
alter table public.audit_logs
  add column if not exists entity_key text;

-- audit_write: entity_key'yi otomatik doldursun
create or replace function public.audit_write(
  p_org_id uuid,
  p_action public.audit_action,
  p_entity_table text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  v_key := coalesce(
    p_entity_id::text,
    case when p_after is not null then p_after->>'id' else null end,
    case when p_before is not null then p_before->>'id' else null end
  );

  insert into public.audit_logs(
    org_id, actor_user_id, action, entity_table, entity_id, entity_key, before_json, after_json
  )
  values (
    p_org_id, auth.uid(), p_action, p_entity_table, p_entity_id, v_key, p_before, p_after
  );
end;
$$;

-- audit_row_changes: id'yi önce text al, uuid ise cast et, değilse entity_id null kalsın
create or replace function public.audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_org_text text;
  v_org uuid;
  v_id_text text;
  v_id uuid;
  v_action public.audit_action;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_action := 'delete';
    v_before := to_jsonb(old);
    v_after := null;
  end if;

  -- org_id'yi JSON'dan oku (tablo org_id içermese bile patlamaz)
  v_org_text := coalesce(
    case when v_after is not null then v_after->>'org_id' else null end,
    case when v_before is not null then v_before->>'org_id' else null end
  );

  begin
    v_org := v_org_text::uuid;
  exception when others then
    v_org := null;
  end;

  -- org_id yoksa audit atla (trigger yanlış tabloda da olsa sistem çökmesin)
  if v_org is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- id'yi text al, uuid ise cast et
  v_id_text := coalesce(
    case when v_after is not null then v_after->>'id' else null end,
    case when v_before is not null then v_before->>'id' else null end
  );

  begin
    v_id := v_id_text::uuid;
  exception when others then
    v_id := null;
  end;

  perform public.audit_write(v_org, v_action, tg_table_name, v_id, v_before, v_after);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- plan_generated trigger fonksiyonu varsa onu da güvenli hale getir
create or replace function public.audit_plan_generated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and old.status = 'draft' and new.status = 'active' then
    perform public.audit_write(new.org_id, 'plan_generated', 'plans', new.id, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

commit;
-- ============================================================
-- KARGO İŞLETME SİSTEMİ (SUPABASE) - Company-grade
-- Auth (Supabase), RBAC, RLS, JWT Custom Claims, PostGIS
-- ============================================================

begin;

-- ----------------------------
-- Extensions
-- ----------------------------
create extension if not exists postgis;
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------
-- Types
-- ----------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cargo_status as enum ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vehicle_status as enum ('available', 'on_route', 'maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_status as enum ('draft', 'active', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vehicle_ownership as enum ('owned', 'rented');
exception when duplicate_object then null; end $$;

-- Fine-grained permissions (RBAC)
do $$ begin
  create type public.app_permission as enum (
    'stations.read','stations.manage',
    'vehicles.read','vehicles.manage',
    'cargos.create','cargos.read_own','cargos.read_all','cargos.update_status',
    'plans.read','plans.manage',
    'system_parameters.read','system_parameters.manage',
    'distance_matrix.read','distance_matrix.manage',
    'trips.read','trips.manage'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------
-- Tenancy
-- ----------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Default org (stable UUID so you can seed data safely)
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111'::uuid, 'Demo Org')
on conflict (id) do nothing;

-- ----------------------------
-- Users (Profile) - links to auth.users
-- ----------------------------
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete restrict,
  email text,
  full_name text,
  role public.user_role not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_org on public.app_users(org_id);
create index if not exists idx_app_users_role on public.app_users(role);

-- Sync profile row when a new auth user is created
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, org_id, email, full_name, role)
  values (
    new.id,
    '11111111-1111-1111-1111-111111111111'::uuid,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Timestamp trigger
create or replace function public.update_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_app_users_updated on public.app_users;
create trigger trg_app_users_updated
before update on public.app_users
for each row execute function public.update_timestamp();

-- ----------------------------
-- RBAC tables + authorize()
-- ----------------------------
create table if not exists public.role_permissions (
  id bigint generated by default as identity primary key,
  role public.user_role not null,
  permission public.app_permission not null,
  unique(role, permission)
);

create index if not exists idx_role_permissions_role_perm on public.role_permissions(role, permission);

-- Seed role permissions (adjust if you want)
insert into public.role_permissions(role, permission) values
  -- admin: everything
  ('admin','stations.read'),('admin','stations.manage'),
  ('admin','vehicles.read'),('admin','vehicles.manage'),
  ('admin','cargos.create'),('admin','cargos.read_own'),('admin','cargos.read_all'),('admin','cargos.update_status'),
  ('admin','plans.read'),('admin','plans.manage'),
  ('admin','system_parameters.read'),('admin','system_parameters.manage'),
  ('admin','distance_matrix.read'),('admin','distance_matrix.manage'),
  ('admin','trips.read'),('admin','trips.manage'),

  -- user: limited
  ('user','stations.read'),
  ('user','vehicles.read'),
  ('user','cargos.create'),
  ('user','cargos.read_own'),
  ('user','plans.read'),
  ('user','distance_matrix.read'),
  ('user','trips.read')
on conflict do nothing;

-- Reads role from JWT claim (fast), checks permission binding
create or replace function public.authorize(requested_permission public.app_permission)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bind_count int;
  r public.user_role;
begin
  -- user_role claim comes from custom access token hook
  select (auth.jwt() ->> 'user_role')::public.user_role into r;

  if r is null then
    -- fallback: read from app_users
    select role into r from public.app_users where id = auth.uid();
  end if;

  select count(*) into bind_count
  from public.role_permissions rp
  where rp.role = r and rp.permission = requested_permission;

  return bind_count > 0;
end;
$$;

-- ----------------------------
-- Domain tables (org scoped)
-- ----------------------------

create table if not exists public.system_parameters (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  param_key varchar(100) not null,
  param_value numeric(10,2) not null,
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  unique(org_id, param_key)
);

create index if not exists idx_sysparams_org_key on public.system_parameters(org_id, param_key);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  name varchar(255) not null,
  code varchar(50) not null,
  latitude numeric(10,8) not null,
  longitude numeric(11,8) not null,
  location geography(point, 4326),
  address text,
  is_hub boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.app_users(id) on delete set null,
  unique(org_id, code)
);

create index if not exists idx_stations_org on public.stations(org_id);
create index if not exists idx_stations_location on public.stations using gist(location);

create or replace function public.set_station_location()
returns trigger language plpgsql as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end; $$;

drop trigger if exists trg_station_location on public.stations;
create trigger trg_station_location
before insert or update on public.stations
for each row execute function public.set_station_location();

drop trigger if exists trg_stations_updated on public.stations;
create trigger trg_stations_updated
before update on public.stations
for each row execute function public.update_timestamp();

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  plate_number varchar(20) not null,
  name varchar(100) not null,
  capacity_kg numeric(10,2) not null,
  fuel_consumption numeric(5,2) default 0.1,
  ownership public.vehicle_ownership not null default 'owned',
  rental_cost numeric(10,2) default 0,
  status public.vehicle_status default 'available',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, plate_number)
);

create index if not exists idx_vehicles_org on public.vehicles(org_id);
create index if not exists idx_vehicles_status on public.vehicles(status);
create index if not exists idx_vehicles_capacity on public.vehicles(capacity_kg);

drop trigger if exists trg_vehicles_updated on public.vehicles;
create trigger trg_vehicles_updated
before update on public.vehicles
for each row execute function public.update_timestamp();

create table if not exists public.cargos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  tracking_code varchar(20) unique not null,
  user_id uuid not null references public.app_users(id) on delete cascade,
  origin_station_id uuid not null references public.stations(id) on delete restrict,
  destination_station_id uuid references public.stations(id) on delete restrict,
  weight_kg numeric(10,2) not null,
  description text,
  status public.cargo_status default 'pending',
  scheduled_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cargos_org on public.cargos(org_id);
create index if not exists idx_cargos_user on public.cargos(user_id);
create index if not exists idx_cargos_status on public.cargos(status);
create index if not exists idx_cargos_origin on public.cargos(origin_station_id);
create index if not exists idx_cargos_scheduled on public.cargos(scheduled_date);

drop trigger if exists trg_cargos_updated on public.cargos;
create trigger trg_cargos_updated
before update on public.cargos
for each row execute function public.update_timestamp();

-- Tracking code generator
create or replace function public.generate_tracking_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := 'KRG-';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.set_tracking_code()
returns trigger
language plpgsql
as $$
begin
  if new.tracking_code is null or new.tracking_code = '' then
    new.tracking_code := public.generate_tracking_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cargo_tracking_code on public.cargos;
create trigger trg_cargo_tracking_code
before insert on public.cargos
for each row execute function public.set_tracking_code();

create table if not exists public.distance_matrix (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  from_station_id uuid not null references public.stations(id) on delete cascade,
  to_station_id uuid not null references public.stations(id) on delete cascade,
  distance_km numeric(10,3) not null,
  duration_minutes numeric(10,2) not null,
  polyline text,
  calculated_at timestamptz default now(),
  unique(org_id, from_station_id, to_station_id)
);

create index if not exists idx_distance_org_from on public.distance_matrix(org_id, from_station_id);
create index if not exists idx_distance_org_to on public.distance_matrix(org_id, to_station_id);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  plan_date date not null,
  problem_type varchar(50) not null, -- unlimited_vehicles / limited_vehicles(_max_count|_max_weight)
  status public.plan_status default 'draft',

  total_distance_km numeric(10,3),
  total_cost numeric(10,2),
  total_cargos int,
  total_weight_kg numeric(10,2),
  vehicles_used int,
  vehicles_rented int,

  cost_per_km numeric(10,2),
  rental_cost numeric(10,2),

  optimizer_result jsonb,

  created_at timestamptz default now(),
  created_by uuid references public.app_users(id) on delete set null
);

create index if not exists idx_plans_org_date on public.plans(org_id, plan_date);
create index if not exists idx_plans_org_status on public.plans(org_id, status);

create table if not exists public.plan_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,

  route_order int not null,

  total_distance_km numeric(10,3) not null,
  total_duration_minutes numeric(10,2),
  total_cost numeric(10,2) not null,
  total_weight_kg numeric(10,2) not null,
  cargo_count int not null,

  route_stations uuid[] not null,
  route_polyline text,
  route_details jsonb,

  created_at timestamptz default now()
);

create index if not exists idx_plan_routes_org_plan on public.plan_routes(org_id, plan_id);
create index if not exists idx_plan_routes_org_vehicle on public.plan_routes(org_id, vehicle_id);

create table if not exists public.plan_route_cargos (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  plan_route_id uuid not null references public.plan_routes(id) on delete cascade,
  cargo_id uuid not null references public.cargos(id) on delete restrict,
  pickup_order int not null,
  unique(plan_route_id, cargo_id)
);

create index if not exists idx_prc_org_route on public.plan_route_cargos(org_id, plan_route_id);
create index if not exists idx_prc_org_cargo on public.plan_route_cargos(org_id, cargo_id);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  plan_route_id uuid references public.plan_routes(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,

  started_at timestamptz,
  completed_at timestamptz,

  actual_distance_km numeric(10,3),
  actual_duration_minutes numeric(10,2),
  actual_cost numeric(10,2),

  status varchar(50) default 'scheduled', -- scheduled/in_progress/completed/cancelled
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_trips_org_vehicle on public.trips(org_id, vehicle_id);
create index if not exists idx_trips_org_status on public.trips(org_id, status);
create index if not exists idx_trips_org_dates on public.trips(org_id, started_at, completed_at);

drop trigger if exists trg_trips_updated on public.trips;
create trigger trg_trips_updated
before update on public.trips
for each row execute function public.update_timestamp();

create table if not exists public.trip_logs (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete cascade,
  station_id uuid references public.stations(id) on delete set null,
  event_type varchar(50) not null, -- departed/arrived/loading/unloading
  event_time timestamptz default now(),
  notes text
);

create index if not exists idx_trip_logs_org_trip on public.trip_logs(org_id, trip_id);

-- ----------------------------
-- Views (org scoped)
-- ----------------------------
create or replace view public.v_daily_station_summary as
select
  c.org_id,
  c.scheduled_date,
  s.id as station_id,
  s.name as station_name,
  s.code as station_code,
  s.latitude,
  s.longitude,
  count(c.id) as cargo_count,
  coalesce(sum(c.weight_kg), 0) as total_weight_kg
from public.stations s
left join public.cargos c
  on c.origin_station_id = s.id
 and c.status = 'pending'
 and c.scheduled_date is not null
where s.is_active = true
group by c.org_id, c.scheduled_date, s.id, s.name, s.code, s.latitude, s.longitude;

-- ----------------------------
-- JWT Custom Claims (Auth Hook)
-- Adds: user_role + org_id
-- ----------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_org uuid;
  v_role public.user_role;
begin
  claims := event->'claims';

  select org_id, role
    into v_org, v_role
  from public.app_users
  where id = (event->>'user_id')::uuid;

  if v_org is not null then
    claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org::text), true);
  else
    claims := jsonb_set(claims, '{org_id}', 'null', true);
  end if;

  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role), true);
  else
    claims := jsonb_set(claims, '{user_role}', 'null', true);
  end if;

  event := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- supabase_auth_admin must be able to read app_users for the hook
alter table public.app_users enable row level security;

do $$ begin
  create policy "auth admin can read app_users"
  on public.app_users
  as permissive for select
  to supabase_auth_admin
  using (true);
exception when duplicate_object then null; end $$;

-- ----------------------------
-- Row Level Security (RLS)
-- ----------------------------

-- Helper: get org from JWT fast (fallback to table)
create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
  o uuid;
begin
  v := auth.jwt() ->> 'org_id';
  if v is not null and v <> '' and v <> 'null' then
    return v::uuid;
  end if;

  select org_id into o from public.app_users where id = auth.uid();
  return o;
end;
$$;

-- app_users: user can read/update own profile, admin can read all in org
do $$ begin
  -- enable RLS already done above
  create policy "app_users read own"
  on public.app_users for select
  to authenticated
  using (id = auth.uid());

  create policy "app_users update own"
  on public.app_users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

  create policy "app_users admin read org"
  on public.app_users for select
  to authenticated
  using ( public.authorize('system_parameters.manage') and org_id = public.current_org_id() );
exception when duplicate_object then null; end $$;

-- role_permissions: lock down (no direct API access)
alter table public.role_permissions enable row level security;
revoke all on table public.role_permissions from anon, authenticated;

-- organizations: users can read their org; admin can manage
alter table public.organizations enable row level security;

do $$ begin
  create policy "org read own"
  on public.organizations for select
  to authenticated
  using (id = public.current_org_id());

  create policy "org admin manage"
  on public.organizations for all
  to authenticated
  using (public.authorize('system_parameters.manage'))
  with check (public.authorize('system_parameters.manage'));
exception when duplicate_object then null; end $$;

-- system_parameters
alter table public.system_parameters enable row level security;

do $$ begin
  create policy "sysparams read"
  on public.system_parameters for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('system_parameters.read'));

  create policy "sysparams manage"
  on public.system_parameters for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('system_parameters.manage'))
  with check (org_id = public.current_org_id() and public.authorize('system_parameters.manage'));
exception when duplicate_object then null; end $$;

-- stations
alter table public.stations enable row level security;

do $$ begin
  create policy "stations read"
  on public.stations for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('stations.read'));

  create policy "stations manage"
  on public.stations for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('stations.manage'))
  with check (org_id = public.current_org_id() and public.authorize('stations.manage'));
exception when duplicate_object then null; end $$;

-- vehicles
alter table public.vehicles enable row level security;

do $$ begin
  create policy "vehicles read"
  on public.vehicles for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('vehicles.read'));

  create policy "vehicles manage"
  on public.vehicles for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('vehicles.manage'))
  with check (org_id = public.current_org_id() and public.authorize('vehicles.manage'));
exception when duplicate_object then null; end $$;

-- cargos
alter table public.cargos enable row level security;

do $$ begin
  create policy "cargos create"
  on public.cargos for insert
  to authenticated
  with check (
    org_id = public.current_org_id()
    and user_id = auth.uid()
    and public.authorize('cargos.create')
  );

  create policy "cargos read own"
  on public.cargos for select
  to authenticated
  using (
    org_id = public.current_org_id()
    and user_id = auth.uid()
    and public.authorize('cargos.read_own')
  );

  create policy "cargos read all (admin)"
  on public.cargos for select
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.authorize('cargos.read_all')
  );

  create policy "cargos update status (admin)"
  on public.cargos for update
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.authorize('cargos.update_status')
  )
  with check (
    org_id = public.current_org_id()
    and public.authorize('cargos.update_status')
  );
exception when duplicate_object then null; end $$;

-- distance_matrix
alter table public.distance_matrix enable row level security;

do $$ begin
  create policy "distance read"
  on public.distance_matrix for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('distance_matrix.read'));

  create policy "distance manage"
  on public.distance_matrix for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('distance_matrix.manage'))
  with check (org_id = public.current_org_id() and public.authorize('distance_matrix.manage'));
exception when duplicate_object then null; end $$;

-- plans
alter table public.plans enable row level security;

do $$ begin
  create policy "plans read"
  on public.plans for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('plans.read'));

  create policy "plans manage"
  on public.plans for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('plans.manage'))
  with check (org_id = public.current_org_id() and public.authorize('plans.manage'));
exception when duplicate_object then null; end $$;

-- plan_routes
alter table public.plan_routes enable row level security;

do $$ begin
  create policy "plan_routes read"
  on public.plan_routes for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('plans.read'));

  create policy "plan_routes manage"
  on public.plan_routes for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('plans.manage'))
  with check (org_id = public.current_org_id() and public.authorize('plans.manage'));
exception when duplicate_object then null; end $$;

-- plan_route_cargos
alter table public.plan_route_cargos enable row level security;

do $$ begin
  create policy "prc read"
  on public.plan_route_cargos for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('plans.read'));

  create policy "prc manage"
  on public.plan_route_cargos for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('plans.manage'))
  with check (org_id = public.current_org_id() and public.authorize('plans.manage'));
exception when duplicate_object then null; end $$;

-- trips
alter table public.trips enable row level security;

do $$ begin
  create policy "trips read"
  on public.trips for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('trips.read'));

  create policy "trips manage"
  on public.trips for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('trips.manage'))
  with check (org_id = public.current_org_id() and public.authorize('trips.manage'));
exception when duplicate_object then null; end $$;

-- trip_logs
alter table public.trip_logs enable row level security;

do $$ begin
  create policy "trip_logs read"
  on public.trip_logs for select
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('trips.read'));

  create policy "trip_logs manage"
  on public.trip_logs for all
  to authenticated
  using (org_id = public.current_org_id() and public.authorize('trips.manage'))
  with check (org_id = public.current_org_id() and public.authorize('trips.manage'));
exception when duplicate_object then null; end $$;

-- ----------------------------
-- Seed data (org-scoped) - no user_id dependency
-- ----------------------------

-- System parameters
insert into public.system_parameters (org_id, param_key, param_value, description)
values
  ('11111111-1111-1111-1111-111111111111','cost_per_km', 1.00, 'Kilometre başına maliyet (birim)'),
  ('11111111-1111-1111-1111-111111111111','rental_cost_500kg', 200.00, '500 kg kapasiteli kiralık araç maliyeti'),
  ('11111111-1111-1111-1111-111111111111','fuel_price_per_liter', 45.00, 'Litre başına yakıt fiyatı (TL)'),
  ('11111111-1111-1111-1111-111111111111','default_fuel_consumption', 0.10, 'Varsayılan yakıt tüketimi (lt/km)'),
  ('11111111-1111-1111-1111-111111111111','max_working_hours', 8.00, 'Maksimum günlük çalışma saati'),
  ('11111111-1111-1111-1111-111111111111','average_speed_kmh', 50.00, 'Ortalama araç hızı (km/saat)')
on conflict (org_id, param_key) do nothing;

-- Stations (Kocaeli)
insert into public.stations (id, org_id, name, code, latitude, longitude, is_hub, is_active)
values
  ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Kocaeli Üniversitesi (Merkez Hub)','HUB',40.8224,29.9256,true,true),
  ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Başiskele','BASISKELE',40.7167,29.9333,false,true),
  ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Çayırova','CAYIROVA',40.8275,29.3772,false,true),
  ('10000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Darıca','DARICA',40.7692,29.3753,false,true),
  ('10000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Derince','DERINCE',40.7550,29.8267,false,true),
  ('10000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Dilovası','DILOVASI',40.7833,29.5333,false,true),
  ('10000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Gebze','GEBZE',40.8028,29.4306,false,true),
  ('10000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Gölcük','GOLCUK',40.7167,29.8167,false,true),
  ('10000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','Kandıra','KANDIRA',41.0711,30.1528,false,true),
  ('10000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','Karamürsel','KARAMURSEL',40.6917,29.6167,false,true),
  ('10000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','Kartepe','KARTEPE',40.7500,30.0333,false,true),
  ('10000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','Körfez','KORFEZ',40.7833,29.7333,false,true),
  ('10000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','İzmit','IZMIT',40.7667,29.9167,false,true)
on conflict (id) do nothing;

-- Vehicles
insert into public.vehicles (id, org_id, plate_number, name, capacity_kg, ownership, rental_cost, status)
values
  ('20000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','41 KRG 001','Araç 1 (500 kg)',500.00,'owned',0,'available'),
  ('20000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','41 KRG 002','Araç 2 (750 kg)',750.00,'owned',0,'available'),
  ('20000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','41 KRG 003','Araç 3 (1000 kg)',1000.00,'owned',0,'available')
on conflict (id) do nothing;

commit;

-- ============================================================
-- IMPORTANT: Enable the Auth Hook in Dashboard:
-- Authentication -> Hooks (Custom Access Token) -> select public.custom_access_token_hook
-- ============================================================
