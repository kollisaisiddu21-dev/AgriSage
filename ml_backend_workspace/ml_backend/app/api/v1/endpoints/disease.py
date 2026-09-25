from fastapi import APIRouter, UploadFile, File
from app.services.vision_service import vision_service

router = APIRouter()

@router.post("/detect-disease")
async def detect_disease(file: UploadFile = File(...)):
    contents = await file.read()
    result = await vision_service.detect_disease(contents)
    return result
