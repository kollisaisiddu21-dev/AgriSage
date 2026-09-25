from fastapi import APIRouter
from app.api.v1.endpoints import crop, disease, field, advisory, soil

api_router = APIRouter()

api_router.include_router(crop.router, tags=["crop"])
api_router.include_router(disease.router, tags=["disease"])
api_router.include_router(field.router, tags=["field"])
api_router.include_router(advisory.router, tags=["advisory"])
api_router.include_router(soil.router, prefix="/soil", tags=["soil"])
