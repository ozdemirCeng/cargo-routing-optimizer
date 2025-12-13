"""
Kargo İşletme Sistemi - Optimizer Service
Kocaeli Üniversitesi Yazılım Lab I - 2025-2026 Güz

Heuristic tabanlı VRP (Vehicle Routing Problem) çözücü.
- Greedy başlangıç çözümü
- 2-opt local search iyileştirme
- Sınırsız araç / Belirli araç problemleri
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import time
import os
import uuid
import logging
import contextvars

from dotenv import load_dotenv

from optimizer import VRPOptimizer
from models import OptimizerInput, OptimizerOutput

load_dotenv()

request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get() or "-"
        return True


def configure_logging() -> logging.Logger:
    level_str = str(os.getenv("LOG_LEVEL", "INFO")).upper().strip()
    level = getattr(logging, level_str, logging.INFO)

    logger = logging.getLogger("optimizer")
    logger.setLevel(level)

    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s [%(name)s] rid=%(request_id)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )

    # Avoid double handlers when uvicorn reloads
    if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
        logger.addHandler(handler)

    logger.propagate = False
    return logger


logger = configure_logging()

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


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_ctx.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)

    response.headers["x-request-id"] = rid
    return response


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

        logger.info(
            "optimize start problem_type=%s stations=%s vehicles=%s",
            input_data.problem_type,
            len(input_data.stations or []),
            len(input_data.vehicles or []),
        )
        
        optimizer = VRPOptimizer(input_data)
        result = optimizer.solve()
        
        execution_time = (time.time() - start_time) * 1000
        result.algorithm_info["execution_time_ms"] = execution_time

        logger.info("optimize done execution_time_ms=%.2f success=%s", execution_time, result.success)
        
        return result
        
    except ValueError as e:
        logger.warning("optimize bad_request: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("optimize failed")
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
