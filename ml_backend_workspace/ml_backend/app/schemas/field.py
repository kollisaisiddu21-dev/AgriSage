from pydantic import BaseModel

class FieldCoordinates(BaseModel):
    lat: float
    lon: float
