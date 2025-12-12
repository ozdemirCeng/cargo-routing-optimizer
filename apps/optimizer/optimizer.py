"""
VRP Optimizer - Heuristic Çözücü

Algoritmalar:
1. Greedy Construction: En yakın komşu + kapasite kontrolü
2. Local Search: 2-opt swap ile iyileştirme
3. Araç atama: Bin packing benzeri yaklaşım

Brute-force KULLANILMIYOR - Sezgisel yaklaşım.
"""

from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from models import (
    OptimizerInput, OptimizerOutput, Summary, RouteResult, RouteStop,
    AssignedCargo, UserInfo, UnassignedCargo, AlgorithmInfo, ErrorInfo
)
import random


@dataclass
class Station:
    """İç kullanım için istasyon yapısı"""
    id: str
    name: str
    code: str
    lat: float
    lon: float
    cargo_count: int
    weight_kg: float
    cargos: List[dict]
    is_hub: bool = False


@dataclass
class Vehicle:
    """İç kullanım için araç yapısı"""
    id: str
    name: str
    capacity_kg: float
    is_rented: bool
    rental_cost: float


class VRPOptimizer:
    """
    Vehicle Routing Problem Optimizer
    Heuristic tabanlı çözüm (Greedy + 2-opt)
    """
    
    def __init__(self, input_data: OptimizerInput):
        self.input = input_data
        self.hub = self._create_hub_station()
        self.stations = self._create_stations()
        self.vehicles = self._create_vehicles()
        self.distances = self._parse_distances()
        self.params = input_data.parameters
        
        # Sonuçlar
        self.routes: List[List[Station]] = []
        self.vehicle_assignments: List[Vehicle] = []
        self.unassigned: List[Station] = []
        self.iterations = 0
        
    def _create_hub_station(self) -> Station:
        """Hub'u Station objesine çevir"""
        return Station(
            id=self.input.hub.id,
            name=self.input.hub.name,
            code="HUB",
            lat=self.input.hub.latitude,
            lon=self.input.hub.longitude,
            cargo_count=0,
            weight_kg=0,
            cargos=[],
            is_hub=True
        )
    
    def _create_stations(self) -> List[Station]:
        """İstasyonları Station objelerine çevir"""
        return [
            Station(
                id=s.id,
                name=s.name,
                code=s.code,
                lat=s.latitude,
                lon=s.longitude,
                cargo_count=s.cargo_count,
                weight_kg=s.total_weight_kg,
                cargos=[c.dict() for c in (s.cargos or [])],
                is_hub=False
            )
            for s in self.input.stations
            if s.cargo_count > 0
        ]
    
    def _create_vehicles(self) -> List[Vehicle]:
        """Araçları Vehicle objelerine çevir"""
        return [
            Vehicle(
                id=v.id,
                name=v.name,
                capacity_kg=v.capacity_kg,
                is_rented=(v.ownership == "rented"),
                rental_cost=v.rental_cost
            )
            for v in self.input.vehicles
        ]
    
    def _parse_distances(self) -> Dict[str, dict]:
        """Mesafe matrisini parse et"""
        distances = {}
        for key, info in self.input.distance_matrix.items():
            distances[key] = {
                "distance_km": info.distance_km,
                "duration_minutes": info.duration_minutes,
                "polyline": info.polyline or ""
            }
        return distances
    
    def get_distance(self, from_id: str, to_id: str) -> float:
        """İki nokta arası mesafe (km)"""
        if from_id == to_id:
            return 0
        key = f"{from_id}_{to_id}"
        if key in self.distances:
            return self.distances[key]["distance_km"]
        # Ters yön dene
        key_rev = f"{to_id}_{from_id}"
        if key_rev in self.distances:
            return self.distances[key_rev]["distance_km"]
        # Fallback: Haversine
        return self._haversine_fallback(from_id, to_id)
    
    def get_duration(self, from_id: str, to_id: str) -> float:
        """İki nokta arası süre (dakika)"""
        key = f"{from_id}_{to_id}"
        if key in self.distances:
            return self.distances[key]["duration_minutes"]
        key_rev = f"{to_id}_{from_id}"
        if key_rev in self.distances:
            return self.distances[key_rev]["duration_minutes"]
        return self.get_distance(from_id, to_id) / 50 * 60  # 50 km/h
    
    def get_polyline(self, from_id: str, to_id: str) -> str:
        """İki nokta arası polyline"""
        key = f"{from_id}_{to_id}"
        if key in self.distances:
            return self.distances[key].get("polyline", "")
        return ""
    
    def _haversine_fallback(self, from_id: str, to_id: str) -> float:
        """Haversine mesafe hesabı (fallback)"""
        import math
        
        # ID'den koordinat bul
        from_station = self._find_station(from_id)
        to_station = self._find_station(to_id)
        
        if not from_station or not to_station:
            return 100  # Default değer
        
        R = 6371  # km
        lat1, lon1 = math.radians(from_station.lat), math.radians(from_station.lon)
        lat2, lon2 = math.radians(to_station.lat), math.radians(to_station.lon)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c * 1.3  # Yol faktörü
    
    def _find_station(self, station_id: str) -> Optional[Station]:
        """ID ile istasyon bul"""
        if station_id == self.hub.id:
            return self.hub
        for s in self.stations:
            if s.id == station_id:
                return s
        return None
    
    def calculate_route_distance(self, route: List[Station]) -> float:
        """Rota toplam mesafesi (Hub -> istasyonlar -> Hub)"""
        if not route:
            return 0
        
        total = self.get_distance(self.hub.id, route[0].id)
        for i in range(len(route) - 1):
            total += self.get_distance(route[i].id, route[i+1].id)
        total += self.get_distance(route[-1].id, self.hub.id)
        
        return total
    
    def calculate_route_weight(self, route: List[Station]) -> float:
        """Rota toplam ağırlığı"""
        return sum(s.weight_kg for s in route)
    
    def calculate_route_cost(self, route: List[Station], vehicle: Vehicle) -> float:
        """Rota maliyeti (mesafe + kiralama)"""
        distance = self.calculate_route_distance(route)
        distance_cost = distance * self.params.cost_per_km
        rental_cost = vehicle.rental_cost if vehicle.is_rented else 0
        return distance_cost + rental_cost
    
    def solve(self) -> OptimizerOutput:
        """
        Ana çözüm metodu.
        Problem tipine göre uygun algoritma çalıştırır.
        """
        if not self.stations:
            return OptimizerOutput(
                success=False,
                problem_type=self.input.problem_type,
                error=ErrorInfo(
                    code="NO_CARGO",
                    message="Taşınacak kargo bulunmuyor"
                )
            )
        
        if self.input.problem_type == "unlimited_vehicles":
            return self._solve_unlimited()
        else:
            return self._solve_limited()
    
    def _solve_unlimited(self) -> OptimizerOutput:
        """
        Sınırsız araç problemi:
        - Tüm kargoları taşı
        - Gerekirse araç kirala
        - Minimum maliyet
        """
        # 1. Greedy atama
        remaining = self.stations.copy()
        routes = []
        vehicles_used = []
        
        # Önce mevcut araçları kullan (kapasiteye göre büyükten küçüğe)
        available_vehicles = sorted(
            [v for v in self.vehicles if not v.is_rented],
            key=lambda v: v.capacity_kg,
            reverse=True
        )
        
        for vehicle in available_vehicles:
            if not remaining:
                break
            
            route = self._greedy_route_for_vehicle(remaining, vehicle.capacity_kg)
            if route:
                routes.append(route)
                vehicles_used.append(vehicle)
                for s in route:
                    remaining.remove(s)
        
        # Kalan kargolar için araç kirala
        rented_count = 0
        while remaining:
            # Yeni kiralık araç oluştur
            rented_count += 1
            rental_vehicle = Vehicle(
                id=f"rental_{rented_count}",
                name=f"Kiralık Araç {rented_count}",
                capacity_kg=self.params.rental_capacity_kg,
                is_rented=True,
                rental_cost=self.params.rental_cost
            )
            
            route = self._greedy_route_for_vehicle(remaining, rental_vehicle.capacity_kg)
            if route:
                routes.append(route)
                vehicles_used.append(rental_vehicle)
                for s in route:
                    remaining.remove(s)
            else:
                # Tek istasyon bile sığmıyor (çok ağır)
                if remaining:
                    self.unassigned.extend(remaining)
                    remaining = []
        
        # 2. 2-opt ile iyileştir
        improved_routes = []
        for route in routes:
            improved = self._two_opt(route)
            improved_routes.append(improved)
            self.iterations += 1
        
        # Sonuç oluştur
        return self._build_output(improved_routes, vehicles_used)
    
    def _solve_limited(self) -> OptimizerOutput:
        """
        Belirli araç problemi:
        - Mevcut araçlarla çalış
        - Minimum maliyet + maksimum kargo
        - Sığmayan kargolar unassigned
        """
        remaining = self.stations.copy()
        routes = []
        
        # Araçları kapasiteye göre sırala (büyükten küçüğe)
        available_vehicles = sorted(
            [v for v in self.vehicles if not v.is_rented],
            key=lambda v: v.capacity_kg,
            reverse=True
        )
        
        # Her araç için rota oluştur
        for vehicle in available_vehicles:
            if not remaining:
                break
            
            route = self._greedy_route_for_vehicle(remaining, vehicle.capacity_kg)
            if route:
                routes.append(route)
                for s in route:
                    remaining.remove(s)
        
        # Sığmayan kargolar
        self.unassigned = remaining
        
        # 2-opt iyileştirme
        improved_routes = []
        for route in routes:
            improved = self._two_opt(route)
            improved_routes.append(improved)
            self.iterations += 1
        
        # Sonuç
        return self._build_output(improved_routes, available_vehicles[:len(improved_routes)])
    
    def _greedy_route_for_vehicle(
        self, 
        available: List[Station], 
        capacity: float
    ) -> List[Station]:
        """
        Greedy rota oluşturma (Nearest Neighbor + Kapasite)
        """
        route = []
        current_weight = 0
        current_pos = self.hub.id
        
        candidates = available.copy()
        
        while candidates:
            # En yakın ve kapasiteye sığan istasyonu bul
            best = None
            best_dist = float('inf')
            
            for station in candidates:
                if current_weight + station.weight_kg <= capacity:
                    dist = self.get_distance(current_pos, station.id)
                    if dist < best_dist:
                        best = station
                        best_dist = dist
            
            if best is None:
                break  # Kapasiteye sığan yok
            
            route.append(best)
            current_weight += best.weight_kg
            current_pos = best.id
            candidates.remove(best)
        
        return route
    
    def _two_opt(self, route: List[Station]) -> List[Station]:
        """
        2-opt local search ile rota iyileştirme.
        Kenar swap yaparak daha kısa rota arar.
        """
        if len(route) < 2:
            return route
        
        improved = True
        best = route.copy()
        
        while improved:
            improved = False
            for i in range(len(best) - 1):
                for j in range(i + 2, len(best)):
                    # i ve j arasını ters çevir
                    new_route = best[:i+1] + best[i+1:j+1][::-1] + best[j+1:]
                    
                    if self.calculate_route_distance(new_route) < self.calculate_route_distance(best):
                        best = new_route
                        improved = True
                        self.iterations += 1
        
        return best
    
    def _build_output(
        self, 
        routes: List[List[Station]], 
        vehicles: List[Vehicle]
    ) -> OptimizerOutput:
        """Sonuç çıktısını oluştur"""
        
        route_results = []
        total_distance = 0
        total_cost = 0
        total_cargos = 0
        total_weight = 0
        rented_count = 0
        
        for idx, (route, vehicle) in enumerate(zip(routes, vehicles)):
            if not route:
                continue
            
            distance = self.calculate_route_distance(route)
            weight = self.calculate_route_weight(route)
            cargo_count = sum(s.cargo_count for s in route)
            distance_cost = distance * self.params.cost_per_km
            rental_cost = vehicle.rental_cost if vehicle.is_rented else 0
            route_cost = distance_cost + rental_cost
            
            # Route sequence
            sequence = [
                RouteStop(
                    order=0,
                    station_id=self.hub.id,
                    station_name=self.hub.name,
                    station_code="HUB",
                    latitude=self.hub.lat,
                    longitude=self.hub.lon,
                    is_hub=True,
                    action="start",
                    cargo_count=0,
                    weight_kg=0
                )
            ]
            
            assigned_cargos = []
            user_cargo_counts = {}
            pickup_order = 0
            
            for order, station in enumerate(route):
                sequence.append(RouteStop(
                    order=order + 1,
                    station_id=station.id,
                    station_name=station.name,
                    station_code=station.code,
                    latitude=station.lat,
                    longitude=station.lon,
                    is_hub=False,
                    action="pickup",
                    cargo_count=station.cargo_count,
                    weight_kg=station.weight_kg
                ))
                
                # Kargo atamaları
                for cargo in station.cargos:
                    pickup_order += 1
                    assigned_cargos.append(AssignedCargo(
                        cargo_id=cargo["id"],
                        user_id=cargo["user_id"],
                        station_id=station.id,
                        weight_kg=cargo["weight_kg"],
                        pickup_order=pickup_order
                    ))
                    user_cargo_counts[cargo["user_id"]] = \
                        user_cargo_counts.get(cargo["user_id"], 0) + 1
            
            sequence.append(RouteStop(
                order=len(route) + 1,
                station_id=self.hub.id,
                station_name=self.hub.name,
                station_code="HUB",
                latitude=self.hub.lat,
                longitude=self.hub.lon,
                is_hub=True,
                action="end",
                cargo_count=0,
                weight_kg=0
            ))
            
            # Polyline birleştir
            polylines = []
            prev_id = self.hub.id
            for station in route:
                pl = self.get_polyline(prev_id, station.id)
                if pl:
                    polylines.append(pl)
                prev_id = station.id
            pl = self.get_polyline(prev_id, self.hub.id)
            if pl:
                polylines.append(pl)
            
            # Duration hesapla
            duration = 0
            prev_id = self.hub.id
            for station in route:
                duration += self.get_duration(prev_id, station.id)
                prev_id = station.id
            duration += self.get_duration(prev_id, self.hub.id)
            
            users = [
                UserInfo(user_id=uid, cargo_count=count)
                for uid, count in user_cargo_counts.items()
            ]
            
            route_results.append(RouteResult(
                vehicle_id=vehicle.id,
                vehicle_name=vehicle.name,
                is_rented=vehicle.is_rented,
                route_order=idx + 1,
                total_distance_km=round(distance, 3),
                total_duration_minutes=round(duration, 2),
                distance_cost=round(distance_cost, 2),
                rental_cost=rental_cost,
                total_cost=round(route_cost, 2),
                total_weight_kg=round(weight, 2),
                cargo_count=cargo_count,
                capacity_utilization=round((weight / vehicle.capacity_kg) * 100, 1),
                route_sequence=sequence,
                polyline=";".join(polylines),  # Polyline'ları birleştir
                assigned_cargos=assigned_cargos,
                users=users
            ))
            
            total_distance += distance
            total_cost += route_cost
            total_cargos += cargo_count
            total_weight += weight
            if vehicle.is_rented:
                rented_count += 1
        
        # Unassigned cargos
        unassigned_list = []
        unassigned_weight = 0
        unassigned_count = 0
        
        for station in self.unassigned:
            for cargo in station.cargos:
                unassigned_list.append(UnassignedCargo(
                    cargo_id=cargo["id"],
                    station_id=station.id,
                    weight_kg=cargo["weight_kg"],
                    reason="Kapasite yetersiz"
                ))
                unassigned_weight += cargo["weight_kg"]
                unassigned_count += 1
        
        return OptimizerOutput(
            success=True,
            problem_type=self.input.problem_type,
            summary=Summary(
                total_distance_km=round(total_distance, 3),
                total_cost=round(total_cost, 2),
                total_cargos=total_cargos,
                total_weight_kg=round(total_weight, 2),
                vehicles_used=len(route_results),
                vehicles_rented=rented_count,
                unassigned_cargos=unassigned_count,
                unassigned_weight_kg=round(unassigned_weight, 2)
            ),
            routes=route_results,
            unassigned=unassigned_list,
            algorithm_info={
                "name": "Greedy + 2-opt",
                "iterations": self.iterations,
                "execution_time_ms": 0,
                "improvement_percentage": 0
            }
        )
