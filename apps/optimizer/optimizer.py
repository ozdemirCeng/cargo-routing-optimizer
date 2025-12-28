"""
VRP Optimizer - Heuristic Çözücü

Algoritmalar:
1. Greedy Construction: En yakın komşu + kapasite kontrolü
2. Local Search: 2-opt swap ile iyileştirme
3. Araç atama: Bin packing benzeri yaklaşım
4. Fleet search: 1/2/3 araç + gerekirse kiralık araç (maliyet karşılaştırması)

Brute-force KULLANILMIYOR - Sezgisel yaklaşım.
"""

from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
import copy
import itertools
import math
from models import (
    OptimizerInput, OptimizerOutput, Summary, RouteResult, RouteStop,
    AssignedCargo, UserInfo, UnassignedCargo, AlgorithmInfo, ErrorInfo
)
import random
import uuid


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


@dataclass
class StopAssignment:
    """A stop on a route with a subset of cargos assigned."""
    station: Station
    cargos: List[dict]
    weight_kg: float


@dataclass
class CandidateSolution:
    """Internal candidate used by the meta-heuristic fleet search."""
    routes: List[List[StopAssignment]]
    vehicles: List[Vehicle]
    unassigned: List[Station]
    assigned_cargo_count: int
    assigned_weight_kg: float
    total_distance_km: float
    total_cost: float
    two_opt_iterations: int
    meta: Dict[str, Any]


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
        self.routes: List[List[StopAssignment]] = []
        self.vehicle_assignments: List[Vehicle] = []
        self.unassigned: List[Station] = []
        # "iterations" artık sadece seçilen (best) çözüm için raporlanır.
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
    
    def calculate_route_distance(self, route: List[StopAssignment]) -> float:
        """Rota toplam mesafesi (istasyonlar -> Hub).

        Araçların tek bir merkezden çıkması zorunlu değil; optimizasyona göre
        farklı başlangıç noktalarından kalkabilir. Bu yüzden başlangıç için
        Hub -> ilk istasyon bacağı maliyete dahil edilmez.
        """
        if not route:
            return 0

        total = 0
        for i in range(len(route) - 1):
            total += self.get_distance(route[i].station.id, route[i + 1].station.id)
        total += self.get_distance(route[-1].station.id, self.hub.id)
        
        return total
    
    def calculate_route_weight(self, route: List[StopAssignment]) -> float:
        """Rota toplam ağırlığı"""
        return sum(s.weight_kg for s in route)
    
    def calculate_route_cost(self, route: List[StopAssignment], vehicle: Vehicle) -> float:
        """Rota maliyeti (mesafe + kiralama)"""
        distance = self.calculate_route_distance(route)
        distance_cost = distance * self.params.cost_per_km
        rental_cost = vehicle.rental_cost if vehicle.is_rented else 0
        return distance_cost + rental_cost

    def _clone_stations(self) -> List[Station]:
        """Deep copy stations because solving mutates cargo lists in-place."""
        return copy.deepcopy(self.stations)

    def _refresh_station_totals(self, st: Station) -> None:
        st.cargo_count = len(st.cargos)
        st.weight_kg = round(sum(float(c.get("weight_kg", 0) or 0) for c in st.cargos), 2)

    def _total_remaining_weight(self, stations: List[Station]) -> float:
        return round(sum(float(s.weight_kg or 0) for s in stations if s.cargos), 2)

    def _total_remaining_cargo_count(self, stations: List[Station]) -> int:
        return sum(len(s.cargos) for s in stations if s.cargos)

    def _total_capacity(self, vehicles: List[Vehicle]) -> float:
        return float(sum(v.capacity_kg for v in vehicles))

    def _get_limited_objective(self) -> str:
        """
        Belirli araç probleminde iki ayrı hedef desteklenir:
        - max_count: maksimum kargo adedi (varsayılan)
        - max_weight: maksimum toplam ağırlık (kg)

        Objective bilgisi problem_type stringi üzerinden taşınır.
        (API tarafında farklı problemType değerleri ile ayrı plan üretilebilir.)
        """
        pt = str(self.input.problem_type or "").strip().lower()
        if "max_weight" in pt or pt.endswith("_weight") or pt.endswith("_kg"):
            return "max_weight"
        return "max_count"

    def _build_rental_vehicle(self, idx: int) -> Vehicle:
        return Vehicle(
            id=f"rental_{uuid.uuid4().hex}",
            name=f"Kiralık Araç {idx}",
            capacity_kg=self.params.rental_capacity_kg,
            is_rented=True,
            rental_cost=self.params.rental_cost,
        )

    def _pick_farthest_seeds(
        self, stations: List[Station], k: int, rng: random.Random
    ) -> List[Station]:
        """
        Farthest-first seeding (k-center style).
        Randomness is only used as tie-breaker to produce multiple candidates.
        """
        if k <= 0 or not stations:
            return []
        if k >= len(stations):
            return stations[:]

        # First seed: among top-3 farthest from hub (random tie-break)
        scored = sorted(
            stations,
            key=lambda s: self.get_distance(s.id, self.hub.id),
            reverse=True,
        )
        top = scored[: min(3, len(scored))]
        seeds = [rng.choice(top)]

        remaining = [s for s in stations if s.id != seeds[0].id]
        while len(seeds) < k and remaining:
            # Pick station maximizing distance to nearest seed
            best_score = -1.0
            best: List[Station] = []
            for st in remaining:
                d = min(self.get_distance(st.id, sd.id) for sd in seeds)
                if d > best_score + 1e-9:
                    best_score = d
                    best = [st]
                elif abs(d - best_score) <= 1e-9:
                    best.append(st)
            chosen = rng.choice(best) if best else remaining[0]
            seeds.append(chosen)
            remaining = [s for s in remaining if s.id != chosen.id]
        return seeds

    def _clusters_by_seeds(
        self, stations: List[Station], seeds: List[Station], rng: random.Random
    ) -> List[List[Station]]:
        """
        Assign each station to nearest seed (distance matrix based).
        Returns clusters list aligned to seeds order.
        """
        if not seeds:
            return []
        clusters: Dict[str, List[Station]] = {s.id: [] for s in seeds}

        for st in stations:
            # Assign to nearest seed (tie-break random)
            best_seed_id: Optional[str] = None
            best_dist = float("inf")
            tied: List[str] = []
            for sd in seeds:
                d = self.get_distance(st.id, sd.id)
                if d < best_dist - 1e-9:
                    best_dist = d
                    tied = [sd.id]
                elif abs(d - best_dist) <= 1e-9:
                    tied.append(sd.id)
            best_seed_id = rng.choice(tied) if tied else seeds[0].id
            clusters[best_seed_id].append(st)

        return [clusters[s.id] for s in seeds]
    
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
        # Fleet search: owned subset + optional extra rentals (cost comparison)
        base_stations = self._clone_stations()
        for st in base_stations:
            self._refresh_station_totals(st)

        total_weight = self._total_remaining_weight(base_stations)

        owned_vehicles = [v for v in self.vehicles if not v.is_rented]
        if not owned_vehicles:
            # No owned vehicles - rely on rentals only
            owned_subsets = [()]
        else:
            # Consider all non-empty subsets (small N in project: 3 vehicles)
            owned_subsets = []
            for r in range(1, len(owned_vehicles) + 1):
                owned_subsets.extend(itertools.combinations(owned_vehicles, r))

        # Heuristic limits (keep runtime bounded)
        max_extra_rentals = 100  # Sınırsız araç problemi için yüksek limit
        attempts_per_scenario = 8

        best: Optional[CandidateSolution] = None

        for owned_subset in owned_subsets:
            owned_subset_list = list(owned_subset)
            owned_capacity = self._total_capacity(owned_subset_list)
            shortfall = max(0.0, total_weight - owned_capacity)
            min_needed_rentals = int(math.ceil(shortfall / float(self.params.rental_capacity_kg))) if shortfall > 0 else 0

            for extra_rentals in range(0, max_extra_rentals + 1):
                rental_count = min_needed_rentals + extra_rentals
                vehicles_pool: List[Vehicle] = owned_subset_list[:] + [
                    self._build_rental_vehicle(i + 1) for i in range(rental_count)
                ]

                # Run multiple randomized candidates for this fleet size
                for attempt in range(attempts_per_scenario):
                    rng = random.Random(
                        hash((self.input.plan_date, "unlimited", len(owned_subset_list), rental_count, attempt))
                    )

                    candidate = self._build_candidate_unlimited(
                        vehicles_pool=vehicles_pool,
                        base_stations=base_stations,
                        rng=rng,
                    )

                    if candidate is None:
                        continue

                    if best is None:
                        best = candidate
                        continue

                    # Minimize total cost; tie-break: fewer rented, fewer vehicles used
                    if candidate.total_cost < best.total_cost - 1e-6:
                        best = candidate
                    elif abs(candidate.total_cost - best.total_cost) <= 1e-6:
                        cand_rented = sum(1 for v in candidate.vehicles if v.is_rented)
                        best_rented = sum(1 for v in best.vehicles if v.is_rented)
                        if cand_rented < best_rented:
                            best = candidate
                        elif cand_rented == best_rented and len(candidate.vehicles) < len(best.vehicles):
                            best = candidate

        if best is None:
            return OptimizerOutput(
                success=False,
                problem_type=self.input.problem_type,
                error=ErrorInfo(
                    code="INFEASIBLE_SOLUTION",
                    message="Uygun çözüm bulunamadı (kapasite yetersiz veya kargo bölünemiyor)",
                ),
            )

        # Build final output from best candidate
        self.unassigned = best.unassigned
        self.iterations = best.two_opt_iterations
        return self._build_output(
            best.routes,
            best.vehicles,
            algorithm_info={
                "name": "Fleet Search (owned+rental) + clustering/binpack + 2-opt",
                "iterations": best.two_opt_iterations,
                "execution_time_ms": 0,
                "improvement_percentage": 0,
                "selected": best.meta,
            },
        )
    
    def _solve_limited(self) -> OptimizerOutput:
        """
        Belirli araç problemi:
        - Mevcut araçlarla çalış
        - Minimum maliyet + maksimum kargo
        - Sığmayan kargolar unassigned
        """
        objective = self._get_limited_objective()

        # Limited vehicles: choose subset of owned vehicles (1/2/3) by
        # primary objective: maximize assigned cargos/weight, secondary: minimize cost.
        base_stations = self._clone_stations()
        for st in base_stations:
            self._refresh_station_totals(st)

        owned_vehicles = sorted([v for v in self.vehicles if not v.is_rented], key=lambda v: v.capacity_kg, reverse=True)
        if not owned_vehicles:
            return OptimizerOutput(
                success=False,
                problem_type=self.input.problem_type,
                error=ErrorInfo(code="NO_VEHICLES", message="Araç bulunamadı"),
            )

        attempts_per_scenario = 6
        best: Optional[CandidateSolution] = None

        for r in range(1, len(owned_vehicles) + 1):
            for subset in itertools.combinations(owned_vehicles, r):
                vehicles_pool = list(subset)
                for attempt in range(attempts_per_scenario):
                    rng = random.Random(hash((self.input.plan_date, "limited", objective, r, attempt)))
                    candidate = self._build_candidate_limited(
                        vehicles_pool=vehicles_pool,
                        base_stations=base_stations,
                        rng=rng,
                        objective=objective,
                    )
                    if candidate is None:
                        continue

                    if best is None:
                        best = candidate
                        continue

                    # Objective-specific lexicographic compare:
                    # 1) Maximize payload (count or weight)
                    # 2) Minimize cost
                    # 3) Tie-breakers: other payload metric, fewer vehicles
                    if objective == "max_weight":
                        if candidate.assigned_weight_kg > best.assigned_weight_kg + 1e-6:
                            best = candidate
                        elif abs(candidate.assigned_weight_kg - best.assigned_weight_kg) <= 1e-6:
                            if candidate.total_cost < best.total_cost - 1e-6:
                                best = candidate
                            elif abs(candidate.total_cost - best.total_cost) <= 1e-6:
                                if candidate.assigned_cargo_count > best.assigned_cargo_count:
                                    best = candidate
                                elif (
                                    candidate.assigned_cargo_count == best.assigned_cargo_count
                                    and len(candidate.vehicles) < len(best.vehicles)
                                ):
                                    best = candidate
                    else:
                        if candidate.assigned_cargo_count > best.assigned_cargo_count:
                            best = candidate
                        elif candidate.assigned_cargo_count == best.assigned_cargo_count:
                            if candidate.total_cost < best.total_cost - 1e-6:
                                best = candidate
                            elif abs(candidate.total_cost - best.total_cost) <= 1e-6:
                                if candidate.assigned_weight_kg > best.assigned_weight_kg + 1e-6:
                                    best = candidate
                                elif (
                                    abs(candidate.assigned_weight_kg - best.assigned_weight_kg) <= 1e-6
                                    and len(candidate.vehicles) < len(best.vehicles)
                                ):
                                    best = candidate

        if best is None:
            return OptimizerOutput(
                success=False,
                problem_type=self.input.problem_type,
                error=ErrorInfo(
                    code="INFEASIBLE_SOLUTION",
                    message="Uygun çözüm bulunamadı",
                ),
            )

        self.unassigned = best.unassigned
        self.iterations = best.two_opt_iterations
        return self._build_output(
            best.routes,
            best.vehicles,
            algorithm_info={
                "name": f"Fleet Search (subset:{objective}) + clustering/binpack/pack + 2-opt",
                "iterations": best.two_opt_iterations,
                "execution_time_ms": 0,
                "improvement_percentage": 0,
                "selected": best.meta,
            },
        )
    
    def _greedy_route_for_vehicle(
        self, 
        available: List[Station], 
        capacity: float,
        objective: Optional[str] = None,
        allowed_cargo_ids: Optional[set[str]] = None,
    ) -> List[StopAssignment]:
        """
        Greedy rota oluşturma (Reverse Nearest Neighbor + Kapasite)

        İsterlere göre araçların tek bir merkezden başlaması zorunlu değil.
        Ancak tüm rotalar Hub'da (Umuttepe) bitmeli.

        Bu yüzden rotayı HUB'dan geriye doğru kurarız:
        - İlk seçilen istasyon Hub'a en yakın olan (son pickup)
        - Sonra onun en yakını (bir önceki pickup) ...
        Böylece gerçek seyir sırası, seçilen listenin tersidir.
        """
        # route_rev: Hub'a doğru giden sırada (last -> ... -> first)
        route_rev: List[StopAssignment] = []
        current_weight = 0
        current_pos = self.hub.id
        
        candidates = available.copy()

        # Ensure totals are consistent (especially after previous routes).
        for st in candidates:
            self._refresh_station_totals(st)
        
        objective_norm = str(objective or "").strip().lower() or None
        if objective_norm not in ("max_count", "max_weight"):
            objective_norm = None

        def cargo_id(c: dict) -> str:
            return str(c.get("id"))

        def cargo_w(c: dict) -> float:
            return float(c.get("weight_kg", 0) or 0)

        def station_allowed_cargos(st: Station) -> List[dict]:
            if allowed_cargo_ids is None:
                return list(st.cargos or [])
            return [c for c in (st.cargos or []) if cargo_id(c) in allowed_cargo_ids]

        while candidates:
            remaining_cap = capacity - current_weight
            if remaining_cap <= 1e-6:
                break

            # Hub'a (veya bir sonraki stop'a) en yakın ve kapasiteye sığan istasyonu bul
            best: Optional[Station] = None
            best_dist = float("inf")
            best_benefit_primary = -1.0
            best_benefit_secondary = -1.0

            for station in candidates:
                if not station.cargos:
                    continue

                allowed = station_allowed_cargos(station)
                if not allowed:
                    continue

                # Station must have at least one cargo that fits remaining capacity
                fit_ws = [cargo_w(c) for c in allowed if cargo_w(c) <= remaining_cap + 1e-6]
                if not fit_ws:
                    continue

                dist = self.get_distance(current_pos, station.id)

                # Benefit (tie-breaker): how much can we load from this station given remaining capacity?
                benefit_count = 0.0
                benefit_weight = 0.0
                if objective_norm is not None:
                    ws = sorted(fit_ws, reverse=(objective_norm == "max_weight"))
                    cap_left = remaining_cap
                    for w in ws:
                        if w <= cap_left + 1e-6:
                            benefit_count += 1.0
                            benefit_weight += w
                            cap_left -= w

                if dist < best_dist - 1e-9:
                    best = station
                    best_dist = dist
                    if objective_norm == "max_weight":
                        best_benefit_primary = benefit_weight
                        best_benefit_secondary = benefit_count
                    else:
                        best_benefit_primary = benefit_count
                        best_benefit_secondary = benefit_weight
                elif abs(dist - best_dist) <= 1e-9 and objective_norm is not None:
                    cand_primary = benefit_weight if objective_norm == "max_weight" else benefit_count
                    cand_secondary = benefit_count if objective_norm == "max_weight" else benefit_weight
                    if cand_primary > best_benefit_primary + 1e-9:
                        best = station
                        best_benefit_primary = cand_primary
                        best_benefit_secondary = cand_secondary
                    elif abs(cand_primary - best_benefit_primary) <= 1e-9 and cand_secondary > best_benefit_secondary + 1e-9:
                        best = station
                        best_benefit_primary = cand_primary
                        best_benefit_secondary = cand_secondary

            if best is None:
                break  # Kapasiteye sığan yok (veya allowed cargo yok)

            assigned: List[dict] = []
            assigned_w = 0.0

            # For "max_count" take lighter cargos first; for "max_weight" take heavier first.
            if objective_norm == "max_count":
                best.cargos.sort(key=cargo_w)
            elif objective_norm == "max_weight":
                best.cargos.sort(key=cargo_w, reverse=True)

            # Greedily take cargos from this station until capacity is filled.
            # NOTE: This enables splitting a station across multiple vehicles/routes.
            i = 0
            while i < len(best.cargos):
                cargo = best.cargos[i]
                if allowed_cargo_ids is not None and cargo_id(cargo) not in allowed_cargo_ids:
                    i += 1
                    continue
                w = float(cargo.get("weight_kg", 0) or 0)
                # Allow tiny epsilon to avoid float rounding deadlocks.
                if w <= remaining_cap + 1e-6:
                    assigned.append(cargo)
                    assigned_w += w
                    remaining_cap -= w
                    best.cargos.pop(i)
                    continue
                i += 1

            # If we couldn't assign any cargo from this station, stop.
            if not assigned:
                # Defensive: remove the station and continue trying others.
                # (This should be rare because we filter by "fit_ws" above.)
                if best in candidates:
                    candidates.remove(best)
                continue

            self._refresh_station_totals(best)
            route_rev.append(StopAssignment(station=best, cargos=assigned, weight_kg=round(assigned_w, 2)))
            current_weight += assigned_w
            current_pos = best.id

            # If fully served, remove from candidates. Otherwise keep for future routes.
            if not best.cargos:
                candidates.remove(best)

        # Gerçek rota sırası: serbest başlangıç -> ... -> Hub
        return list(reversed(route_rev))
    
    def _two_opt(self, route: List[StopAssignment]) -> Tuple[List[StopAssignment], int]:
        """
        2-opt local search ile rota iyileştirme.
        Kenar swap yaparak daha kısa rota arar.
        """
        if len(route) < 2:
            return route, 0
        
        improved = True
        best = route.copy()
        iters = 0
        
        while improved:
            improved = False
            for i in range(len(best) - 1):
                for j in range(i + 2, len(best)):
                    # i ve j arasını ters çevir
                    new_route = best[:i+1] + best[i+1:j+1][::-1] + best[j+1:]
                    
                    if self.calculate_route_distance(new_route) < self.calculate_route_distance(best):
                        best = new_route
                        improved = True
                        iters += 1
        
        return best, iters

    def _candidate_from_routes(
        self,
        routes: List[List[StopAssignment]],
        vehicles: List[Vehicle],
        stations: List[Station],
        two_opt_iters: int,
        meta: Dict[str, Any],
    ) -> CandidateSolution:
        total_distance = 0.0
        total_cost = 0.0
        assigned_cargo_count = 0
        assigned_weight = 0.0

        for route, v in zip(routes, vehicles):
            if not route:
                continue
            total_distance += self.calculate_route_distance(route)
            total_cost += self.calculate_route_cost(route, v)
            assigned_cargo_count += sum(len(s.cargos) for s in route)
            assigned_weight += self.calculate_route_weight(route)

        unassigned = [s for s in stations if s.cargos]

        return CandidateSolution(
            routes=routes,
            vehicles=vehicles,
            unassigned=unassigned,
            assigned_cargo_count=assigned_cargo_count,
            assigned_weight_kg=round(assigned_weight, 2),
            total_distance_km=round(total_distance, 3),
            total_cost=round(total_cost, 6),
            two_opt_iterations=two_opt_iters,
            meta=meta,
        )

    def _build_candidate_unlimited(
        self,
        vehicles_pool: List[Vehicle],
        base_stations: List[Station],
        rng: random.Random,
    ) -> Optional[CandidateSolution]:
        """
        Build one feasible candidate for unlimited problem with the given vehicle pool.
        Uses two constructive heuristics and keeps the better one:
        - geographic clustering (farthest-first) + route
        - bin-pack-by-weight + route
        """
        # Work on fresh station copies per candidate
        stations = copy.deepcopy(base_stations)
        for st in stations:
            self._refresh_station_totals(st)

        # Only consider stations that have any cargo
        active_stations = [s for s in stations if s.cargos]
        if not active_stations:
            return None

        vehicles_sorted = sorted(vehicles_pool, key=lambda v: v.capacity_kg, reverse=True)
        k = min(len(vehicles_sorted), len(active_stations))
        if k <= 0:
            return None

        best_candidate: Optional[CandidateSolution] = None

        # ---------- Candidate A: clustering ----------
        seeds = self._pick_farthest_seeds(active_stations, k, rng)
        clusters = self._clusters_by_seeds(active_stations, seeds, rng)

        # Pair bigger vehicles with heavier clusters
        cluster_infos = []
        for idx, cl in enumerate(clusters):
            w = sum(float(s.weight_kg or 0) for s in cl)
            cluster_infos.append((w, idx, cl))
        cluster_infos.sort(key=lambda x: x[0], reverse=True)

        routes_a: List[List[StopAssignment]] = []
        vehicles_a: List[Vehicle] = []
        two_opt_iters_a = 0

        for vi, (_, _, cl) in enumerate(cluster_infos):
            if vi >= len(vehicles_sorted):
                break
            v = vehicles_sorted[vi]
            route = self._greedy_route_for_vehicle(cl, v.capacity_kg)
            if route:
                improved, it = self._two_opt(route)
                routes_a.append(improved)
                vehicles_a.append(v)
                two_opt_iters_a += it

        cand_a = self._candidate_from_routes(
            routes=routes_a,
            vehicles=vehicles_a,
            stations=stations,
            two_opt_iters=two_opt_iters_a,
            meta={
                "strategy": "cluster",
                "owned_used": sum(1 for v in vehicles_a if not v.is_rented),
                "rented_used": sum(1 for v in vehicles_a if v.is_rented),
                "fleet_size": len(vehicles_pool),
            },
        )

        # Feasibility: all cargos must be assigned
        if not cand_a.unassigned:
            best_candidate = cand_a

        # ---------- Candidate B: bin-pack by weight ----------
        # Re-clone because previous candidate mutated station cargos
        stations_b = copy.deepcopy(base_stations)
        for st in stations_b:
            self._refresh_station_totals(st)
        active_stations_b = [s for s in stations_b if s.cargos]

        # Greedy assignment of whole-stations to vehicles by remaining capacity
        remaining_caps = [float(v.capacity_kg) for v in vehicles_sorted[:k]]
        buckets: List[List[Station]] = [[] for _ in range(k)]

        sts_sorted = sorted(active_stations_b, key=lambda s: float(s.weight_kg or 0), reverse=True)
        for st in sts_sorted:
            w = float(st.weight_kg or 0)
            # Find bucket where it fits best (most remaining after fit)
            best_i = None
            best_rem_after = None
            for i in range(k):
                if w <= remaining_caps[i] + 1e-6:
                    rem_after = remaining_caps[i] - w
                    if best_rem_after is None or rem_after < best_rem_after:
                        best_rem_after = rem_after
                        best_i = i
            if best_i is None:
                # Doesn't fit anywhere as a whole; put into the bucket with max remaining
                best_i = max(range(k), key=lambda i: remaining_caps[i])
            buckets[best_i].append(st)
            remaining_caps[best_i] = max(0.0, remaining_caps[best_i] - w)

        routes_b: List[List[StopAssignment]] = []
        vehicles_b: List[Vehicle] = []
        two_opt_iters_b = 0

        for i in range(k):
            v = vehicles_sorted[i]
            route = self._greedy_route_for_vehicle(buckets[i], v.capacity_kg)
            if route:
                improved, it = self._two_opt(route)
                routes_b.append(improved)
                vehicles_b.append(v)
                two_opt_iters_b += it

        cand_b = self._candidate_from_routes(
            routes=routes_b,
            vehicles=vehicles_b,
            stations=stations_b,
            two_opt_iters=two_opt_iters_b,
            meta={
                "strategy": "binpack",
                "owned_used": sum(1 for v in vehicles_b if not v.is_rented),
                "rented_used": sum(1 for v in vehicles_b if v.is_rented),
                "fleet_size": len(vehicles_pool),
            },
        )

        if not cand_b.unassigned:
            if best_candidate is None or cand_b.total_cost < best_candidate.total_cost - 1e-6:
                best_candidate = cand_b
            elif best_candidate is not None and abs(cand_b.total_cost - best_candidate.total_cost) <= 1e-6:
                # tie-break: fewer rented
                if cand_b.meta.get("rented_used", 0) < best_candidate.meta.get("rented_used", 0):
                    best_candidate = cand_b

        # ---------- Candidate C: sequential greedy (allows splitting a station across vehicles) ----------
        stations_c = copy.deepcopy(base_stations)
        for st in stations_c:
            self._refresh_station_totals(st)
        remaining_c = [s for s in stations_c if s.cargos]

        routes_c: List[List[StopAssignment]] = []
        vehicles_c: List[Vehicle] = []
        two_opt_iters_c = 0

        for v in vehicles_sorted:
            if not remaining_c:
                break
            route = self._greedy_route_for_vehicle(remaining_c, v.capacity_kg)
            if route:
                improved, it = self._two_opt(route)
                routes_c.append(improved)
                vehicles_c.append(v)
                two_opt_iters_c += it
                remaining_c = [s for s in remaining_c if s.cargos]

        cand_c = self._candidate_from_routes(
            routes=routes_c,
            vehicles=vehicles_c,
            stations=stations_c,
            two_opt_iters=two_opt_iters_c,
            meta={
                "strategy": "sequential",
                "owned_used": sum(1 for v in vehicles_c if not v.is_rented),
                "rented_used": sum(1 for v in vehicles_c if v.is_rented),
                "fleet_size": len(vehicles_pool),
            },
        )

        if not cand_c.unassigned:
            if best_candidate is None or cand_c.total_cost < best_candidate.total_cost - 1e-6:
                best_candidate = cand_c
            elif best_candidate is not None and abs(cand_c.total_cost - best_candidate.total_cost) <= 1e-6:
                if cand_c.meta.get("rented_used", 0) < best_candidate.meta.get("rented_used", 0):
                    best_candidate = cand_c

        return best_candidate

    def _build_candidate_limited(
        self,
        vehicles_pool: List[Vehicle],
        base_stations: List[Station],
        rng: random.Random,
        objective: str,
    ) -> Optional[CandidateSolution]:
        """
        Limited candidate builder (no rentals added here). Can leave unassigned.
        """
        objective_norm = str(objective or "").strip().lower() or "max_count"
        if objective_norm not in ("max_count", "max_weight"):
            objective_norm = "max_count"

        stations = copy.deepcopy(base_stations)
        for st in stations:
            self._refresh_station_totals(st)

        active_stations = [s for s in stations if s.cargos]
        if not active_stations:
            return None

        vehicles_sorted = sorted(vehicles_pool, key=lambda v: v.capacity_kg, reverse=True)
        k = min(len(vehicles_sorted), len(active_stations))
        if k <= 0:
            return None

        # Mix strategies (heuristic; not brute-force over assignments)
        # - pack: global cargo packing (max_count -> light-first, max_weight -> heavy-first)
        # - cluster/binpack: geography/weight based grouping
        # - sequential: simple greedy over all stations
        r = rng.random()
        if r < 0.45:
            strategy = "pack"
        elif r < 0.75:
            strategy = "cluster"
        elif r < 0.9:
            strategy = "binpack"
        else:
            strategy = "sequential"

        routes: List[List[StopAssignment]] = []
        vehicles_used: List[Vehicle] = []
        two_opt_iters = 0

        if strategy == "pack":
            # Global cargo packing with per-cargo acceptance (allows leaving some cargos unassigned)
            cargo_items: List[Tuple[str, float]] = []
            for st in stations:
                for c in (st.cargos or []):
                    cid = str(c.get("id"))
                    w = float(c.get("weight_kg", 0) or 0)
                    if w <= 0:
                        continue
                    cargo_items.append((cid, w))

            if not cargo_items:
                return None

            cargo_items.sort(key=lambda x: x[1], reverse=(objective_norm == "max_weight"))

            remaining_caps = [float(v.capacity_kg) for v in vehicles_sorted[:k]]
            allowed_sets: List[set[str]] = [set() for _ in range(k)]

            # Best-fit packing: place each cargo into the tightest vehicle that can still fit it
            for cid, w in cargo_items:
                best_i = None
                best_rem_after = None
                for i in range(k):
                    if w <= remaining_caps[i] + 1e-6:
                        rem_after = remaining_caps[i] - w
                        if best_rem_after is None or rem_after < best_rem_after:
                            best_rem_after = rem_after
                            best_i = i
                if best_i is None:
                    continue
                allowed_sets[best_i].add(cid)
                remaining_caps[best_i] = max(0.0, remaining_caps[best_i] - w)

            for i in range(k):
                allowed = allowed_sets[i]
                if not allowed:
                    continue
                v = vehicles_sorted[i]
                avail = [
                    st
                    for st in stations
                    if any(str(c.get("id")) in allowed for c in (st.cargos or []))
                ]
                if not avail:
                    continue

                route = self._greedy_route_for_vehicle(
                    avail, v.capacity_kg, objective=objective_norm, allowed_cargo_ids=allowed
                )
                if route:
                    improved, it = self._two_opt(route)
                    routes.append(improved)
                    vehicles_used.append(v)
                    two_opt_iters += it

        elif strategy == "cluster":
            seeds = self._pick_farthest_seeds(active_stations, k, rng)
            clusters = self._clusters_by_seeds(active_stations, seeds, rng)

            cluster_infos = []
            for idx, cl in enumerate(clusters):
                w = sum(float(s.weight_kg or 0) for s in cl)
                cluster_infos.append((w, idx, cl))
            cluster_infos.sort(key=lambda x: x[0], reverse=True)

            for i, (_, _, cl) in enumerate(cluster_infos):
                if i >= len(vehicles_sorted):
                    break
                v = vehicles_sorted[i]
                route = self._greedy_route_for_vehicle(cl, v.capacity_kg, objective=objective_norm)
                if route:
                    improved, it = self._two_opt(route)
                    routes.append(improved)
                    vehicles_used.append(v)
                    two_opt_iters += it

        elif strategy == "binpack":
            # Binpack assignment
            remaining_caps = [float(v.capacity_kg) for v in vehicles_sorted[:k]]
            buckets: List[List[Station]] = [[] for _ in range(k)]
            sts_sorted = sorted(active_stations, key=lambda s: float(s.weight_kg or 0), reverse=True)
            for st in sts_sorted:
                w = float(st.weight_kg or 0)
                best_i = None
                best_rem_after = None
                for i in range(k):
                    if w <= remaining_caps[i] + 1e-6:
                        rem_after = remaining_caps[i] - w
                        if best_rem_after is None or rem_after < best_rem_after:
                            best_rem_after = rem_after
                            best_i = i
                if best_i is None:
                    best_i = max(range(k), key=lambda i: remaining_caps[i])
                buckets[best_i].append(st)
                remaining_caps[best_i] = max(0.0, remaining_caps[best_i] - w)

            for i in range(k):
                v = vehicles_sorted[i]
                route = self._greedy_route_for_vehicle(buckets[i], v.capacity_kg, objective=objective_norm)
                if route:
                    improved, it = self._two_opt(route)
                    routes.append(improved)
                    vehicles_used.append(v)
                    two_opt_iters += it

        else:
            # Sequential greedy over all stations (allows splitting stations across vehicles)
            remaining = [s for s in stations if s.cargos]
            for v in vehicles_sorted[:k]:
                if not remaining:
                    break
                route = self._greedy_route_for_vehicle(remaining, v.capacity_kg, objective=objective_norm)
                if route:
                    improved, it = self._two_opt(route)
                    routes.append(improved)
                    vehicles_used.append(v)
                    two_opt_iters += it
                    remaining = [s for s in remaining if s.cargos]

        cand = self._candidate_from_routes(
            routes=routes,
            vehicles=vehicles_used,
            stations=stations,
            two_opt_iters=two_opt_iters,
            meta={
                "strategy": strategy,
                "objective": objective_norm,
                "owned_used": len(vehicles_used),
                "rented_used": 0,
                "fleet_size": len(vehicles_pool),
            },
        )
        return cand
    
    def _build_output(
        self, 
        routes: List[List[StopAssignment]], 
        vehicles: List[Vehicle],
        algorithm_info: Optional[Dict[str, Any]] = None,
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
            cargo_count = sum(len(s.cargos) for s in route)
            distance_cost = distance * self.params.cost_per_km
            rental_cost = vehicle.rental_cost if vehicle.is_rented else 0
            route_cost = distance_cost + rental_cost
            
            # Route sequence: araçlar farklı istasyonlardan başlayabilir;
            # bu yüzden başlangıç stop'u Hub değil, ilk pickup istasyonu olur.
            sequence = []
            
            assigned_cargos = []
            user_cargo_counts = {}
            pickup_order = 0
            
            for order, stop in enumerate(route):
                station = stop.station
                sequence.append(RouteStop(
                    order=order,
                    station_id=station.id,
                    station_name=station.name,
                    station_code=station.code,
                    latitude=station.lat,
                    longitude=station.lon,
                    is_hub=False,
                    action="pickup",
                    cargo_count=len(stop.cargos),
                    weight_kg=stop.weight_kg
                ))
                
                # Kargo atamaları
                for cargo in stop.cargos:
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
                order=len(route),
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
            
            # Polyline birleştir (başlangıç istasyonu -> ... -> Hub)
            polylines = []
            prev_id = route[0].station.id
            for stop in route[1:]:
                pl = self.get_polyline(prev_id, stop.station.id)
                if pl:
                    polylines.append(pl)
                prev_id = stop.station.id
            pl = self.get_polyline(prev_id, self.hub.id)
            if pl:
                polylines.append(pl)
            
            # Duration hesapla (başlangıç istasyonu -> ... -> Hub)
            duration = 0
            prev_id = route[0].station.id
            for stop in route[1:]:
                duration += self.get_duration(prev_id, stop.station.id)
                prev_id = stop.station.id
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
            algorithm_info=(
                algorithm_info
                if algorithm_info is not None
                else {
                "name": "Reverse Greedy (end@hub) + 2-opt",
                "iterations": self.iterations,
                "execution_time_ms": 0,
                    "improvement_percentage": 0,
            }
            ),
        )
