"""
Kargo İşletme Sistemi - Optimizer Service
Kocaeli Üniversitesi Yazılım Lab I - 2025-2026 Güz

Heuristic tabanlı VRP (Vehicle Routing Problem) çözücü.
- Greedy başlangıç çözümü
- 2-opt local search iyileştirme
- Sınırsız araç / Belirli araç problemleri
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import time

from optimizer import VRPOptimizer
from models import OptimizerInput, OptimizerOutput

app = FastAPI(
    title="Kargo Optimizer Service",
    description="Heuristic tabanlı VRP çözücü - Greedy + 2-opt",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Servis sağlık kontrolü"""
    return {"status": "healthy", "service": "optimizer"}


@app.post("/optimize", response_model=OptimizerOutput)
def optimize(input_data: OptimizerInput):
    """
    Rota optimizasyonu yap.
    
    İki problem tipi desteklenir:
    - unlimited_vehicles: Sınırsız araç, minimum maliyet (gerekirse araç kirala)
    - limited_vehicles: Belirli araçlar, minimum maliyet + maksimum kargo
    """
    try:
        start_time = time.time()
        
        optimizer = VRPOptimizer(input_data)
        result = optimizer.solve()
        
        execution_time = (time.time() - start_time) * 1000
        result.algorithm_info["execution_time_ms"] = execution_time
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimizer error: {str(e)}")


@app.post("/validate")
def validate_input(input_data: OptimizerInput):
    """Input validasyonu yap (optimizasyon yapmadan)"""
    try:
        optimizer = VRPOptimizer(input_data)
        return {
            "valid": True,
            "station_count": len(input_data.stations),
            "vehicle_count": len(input_data.vehicles),
            "total_cargo_weight": sum(s.total_weight_kg for s in input_data.stations),
            "total_vehicle_capacity": sum(v.capacity_kg for v in input_data.vehicles),
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
