from fastapi import APIRouter
from app.schemas.advisory import AdvisoryRequest
from app.services.ai_service import ai_service

router = APIRouter()

@router.post("/generate-advisory")
def generate_advisory(req: AdvisoryRequest):
    # Added optional fields user_query and chat_history to schema
    result = ai_service.generate_advisory(
        ml_results=req.ml_results, 
        language=req.language,
        user_query=getattr(req, "user_query", None),
        chat_history=getattr(req, "chat_history", None)
    )
    return result
