"""
Pydantic modelleri - Optimizer Input/Output
"""

from pydantic import BaseModel
from typing import List, Dict, Optional, Any


class HubInfo(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float


class CargoInfo(BaseModel):
    id: str
    weight_kg: float
    user_id: str


class StationInfo(BaseModel):
    id: str
    name: str
    code: str
    latitude: float
    longitude: float
    cargo_count: int
    total_weight_kg: float
    cargos: Optional[List[CargoInfo]] = []


class VehicleInfo(BaseModel):
    id: str
    name: str
    plate_number: str
    capacity_kg: float
    ownership: str  # 'owned' or 'rented'
    rental_cost: float


class Parameters(BaseModel):
    cost_per_km: float = 1.0
    rental_cost: float = 200.0
    rental_capacity_kg: float = 500.0


class DistanceInfo(BaseModel):
    distance_km: float
    duration_minutes: float
    polyline: Optional[str] = ""


class OptimizerInput(BaseModel):
    plan_date: str
    # Supported:
    # - unlimited_vehicles
    # - limited_vehicles (legacy -> max_count)
    # - limited_vehicles_max_count
    # - limited_vehicles_max_weight
    problem_type: str
    hub: HubInfo
    stations: List[StationInfo]
    vehicles: List[VehicleInfo]
    parameters: Parameters
    distance_matrix: Dict[str, DistanceInfo]


# Output modelleri

class RouteStop(BaseModel):
    order: int
    station_id: str
    station_name: str
    station_code: str
    latitude: float
    longitude: float
    is_hub: bool
    action: str  # 'start', 'pickup', 'end'
    cargo_count: int
    weight_kg: float


class AssignedCargo(BaseModel):
    cargo_id: str
    user_id: str
    station_id: str
    weight_kg: float
    pickup_order: int


class UserInfo(BaseModel):
    user_id: str
    cargo_count: int


class RouteResult(BaseModel):
    vehicle_id: str
    vehicle_name: str
    is_rented: bool
    route_order: int
    total_distance_km: float
    total_duration_minutes: float
    distance_cost: float
    rental_cost: float
    total_cost: float
    total_weight_kg: float
    cargo_count: int
    capacity_utilization: float
    route_sequence: List[RouteStop]
    polyline: str
    assigned_cargos: List[AssignedCargo]
    users: List[UserInfo]


class UnassignedCargo(BaseModel):
    cargo_id: str
    station_id: str
    weight_kg: float
    reason: str


class Summary(BaseModel):
    total_distance_km: float
    total_cost: float
    total_cargos: int
    total_weight_kg: float
    vehicles_used: int
    vehicles_rented: int
    unassigned_cargos: int
    unassigned_weight_kg: float


class AlgorithmInfo(BaseModel):
    name: str = "Greedy + 2-opt"
    iterations: int = 0
    execution_time_ms: float = 0
    improvement_percentage: float = 0


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class OptimizerOutput(BaseModel):
    success: bool
    problem_type: str
    summary: Optional[Summary] = None
    routes: List[RouteResult] = []
    unassigned: List[UnassignedCargo] = []
    algorithm_info: Dict[str, Any] = {}
    error: Optional[ErrorInfo] = None
