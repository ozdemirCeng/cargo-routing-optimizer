-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "CargoStatus" AS ENUM ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('available', 'on_route', 'maintenance');

-- CreateEnum
CREATE TYPE "VehicleOwnership" AS ENUM ('owned', 'rented');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameters" (
    "id" SERIAL NOT NULL,
    "param_key" TEXT NOT NULL,
    "param_value" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "address" TEXT,
    "is_hub" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity_kg" DECIMAL(10,2) NOT NULL,
    "fuel_consumption" DECIMAL(5,2) NOT NULL DEFAULT 0.1,
    "ownership" "VehicleOwnership" NOT NULL DEFAULT 'owned',
    "rental_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "VehicleStatus" NOT NULL DEFAULT 'available',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "tracking_code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "origin_station_id" TEXT NOT NULL,
    "destination_station_id" TEXT,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "status" "CargoStatus" NOT NULL DEFAULT 'pending',
    "scheduled_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distance_matrix" (
    "id" SERIAL NOT NULL,
    "from_station_id" TEXT NOT NULL,
    "to_station_id" TEXT NOT NULL,
    "distance_km" DECIMAL(10,3) NOT NULL,
    "duration_minutes" DECIMAL(10,2) NOT NULL,
    "polyline" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distance_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "problem_type" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "total_distance_km" DECIMAL(10,3),
    "total_cost" DECIMAL(10,2),
    "total_cargos" INTEGER,
    "total_weight_kg" DECIMAL(10,2),
    "vehicles_used" INTEGER,
    "vehicles_rented" INTEGER,
    "cost_per_km" DECIMAL(10,2),
    "rental_cost" DECIMAL(10,2),
    "optimizer_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_routes" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "route_order" INTEGER NOT NULL,
    "total_distance_km" DECIMAL(10,3) NOT NULL,
    "total_duration_minutes" DECIMAL(10,2),
    "total_cost" DECIMAL(10,2) NOT NULL,
    "total_weight_kg" DECIMAL(10,2) NOT NULL,
    "cargo_count" INTEGER NOT NULL,
    "route_stations" TEXT[],
    "route_polyline" TEXT,
    "route_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_route_cargos" (
    "id" SERIAL NOT NULL,
    "plan_route_id" TEXT NOT NULL,
    "cargo_id" TEXT NOT NULL,
    "pickup_order" INTEGER NOT NULL,

    CONSTRAINT "plan_route_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "plan_route_id" TEXT,
    "vehicle_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "actual_distance_km" DECIMAL(10,3),
    "actual_duration_minutes" DECIMAL(10,2),
    "actual_cost" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_logs" (
    "id" SERIAL NOT NULL,
    "trip_id" TEXT NOT NULL,
    "station_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "trip_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "system_parameters_param_key_key" ON "system_parameters"("param_key");

-- CreateIndex
CREATE UNIQUE INDEX "stations_code_key" ON "stations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_tracking_code_key" ON "cargos"("tracking_code");

-- CreateIndex
CREATE UNIQUE INDEX "distance_matrix_from_station_id_to_station_id_key" ON "distance_matrix"("from_station_id", "to_station_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_plan_date_problem_type_key" ON "plans"("plan_date", "problem_type");

-- CreateIndex
CREATE UNIQUE INDEX "plan_route_cargos_plan_route_id_cargo_id_key" ON "plan_route_cargos"("plan_route_id", "cargo_id");

-- AddForeignKey
ALTER TABLE "system_parameters" ADD CONSTRAINT "system_parameters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_origin_station_id_fkey" FOREIGN KEY ("origin_station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_destination_station_id_fkey" FOREIGN KEY ("destination_station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distance_matrix" ADD CONSTRAINT "distance_matrix_from_station_id_fkey" FOREIGN KEY ("from_station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distance_matrix" ADD CONSTRAINT "distance_matrix_to_station_id_fkey" FOREIGN KEY ("to_station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_routes" ADD CONSTRAINT "plan_routes_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_routes" ADD CONSTRAINT "plan_routes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_route_cargos" ADD CONSTRAINT "plan_route_cargos_plan_route_id_fkey" FOREIGN KEY ("plan_route_id") REFERENCES "plan_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_route_cargos" ADD CONSTRAINT "plan_route_cargos_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_plan_route_id_fkey" FOREIGN KEY ("plan_route_id") REFERENCES "plan_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_logs" ADD CONSTRAINT "trip_logs_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_logs" ADD CONSTRAINT "trip_logs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
