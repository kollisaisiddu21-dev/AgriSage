from fastapi import APIRouter
from app.schemas.crop import FarmData
from app.services.ai_service import ai_service

from datetime import datetime

router = APIRouter()

@router.post("/predict-crop")
def predict_crop(data: FarmData):
    # Pass ground conditions to LLM multi-provider router to get diverse options across categories
    current_month = datetime.now().strftime("%B")
    
    soil_data = {
        "N": data.N,
        "P": data.P,
        "K": data.K,
        "temperature": data.temperature,
        "humidity": data.humidity,
        "ph": data.ph,
        "rainfall": data.rainfall,
        "current_month_for_planting": current_month
    }
    
    llm_result = ai_service.generate_crop_recommendations(soil_data)
    
    if llm_result["status"] == "success":
        return {"recommended_crops": llm_result["crops"], "status": "success"}
    else:
        # Fallback if LLM entirely fails
        return {
            "recommended_crops": [
                {"crop": "Wheat", "percentage": 85, "image_query": "healthy wheat crop farm"}
            ],
            "status": "partial_success",
            "message": "AI enrichment failed, showing fallback prediction."
        }
