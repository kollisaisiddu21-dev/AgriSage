from fastapi import APIRouter
from app.schemas.field import FieldCoordinates
from app.services.earth_engine_service import earth_engine_service
from app.services.ai_service import ai_service

router = APIRouter()

@router.post("/analyze-field")
def analyze_field(coords: FieldCoordinates):
    result = earth_engine_service.analyze_field(coords.lat, coords.lon)
    
    if result.get("status") == "success":
        llm_res = ai_service.generate_field_analysis(
            ndvi_score=result["ndvi_score"],
            status=result["vegetation_status"]
        )
        if llm_res.get("status") == "success":
            result["llm_analysis"] = llm_res["analysis"]
        else:
            result["llm_analysis"] = "AI analysis currently unavailable."

    return result
