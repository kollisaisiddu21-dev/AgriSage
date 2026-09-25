from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.soil_provider import ISRICSoilGridsProvider, GEESoilProvider
from app.services.climate_provider import OpenMeteoClimateProvider
from app.services.quefts_service import QueftsAdapter
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

soil_provider = ISRICSoilGridsProvider()
gee_soil_provider = GEESoilProvider()
climate_provider = OpenMeteoClimateProvider()
quefts_adapter = QueftsAdapter()

class SoilRequest(BaseModel):
    lat: float
    lon: float

@router.post("/quefts-supply")
async def get_quefts_supply(req: SoilRequest):
    try:
        # 1. Fetch Temperature
        temp = await climate_provider.get_temperature(req.lat, req.lon)
        
        # 2. Fetch Soil Data (ISRIC + GEE)
        soil_data = await soil_provider.get_soil_properties(req.lat, req.lon)
        
        actual_lat = soil_data.get("actual_lat", req.lat)
        actual_lon = soil_data.get("actual_lon", req.lon)
        
        gee_data = await gee_soil_provider.get_soil_properties(actual_lat, actual_lon)
        
        aggregated = soil_data.get("aggregated", {})
        # Merge GEE P and K data into aggregated
        aggregated.update(gee_data.get("aggregated", {}))
        
        # 3. Transform to QUEFTS inputs
        quefts_inputs = quefts_adapter.transform_soilgrids(aggregated)
        
        # 4. Calculate Supply
        supply = quefts_adapter.calculate_nut_supply(quefts_inputs, temp)
        
        limitations = []
        if supply["P"] is None or supply["K"] is None:
            limitations.append("The Google Earth Engine assets for P-Olsen, total-P, and exchangeable-K were either not configured or failed to return data for this location.")
            
        return {
            "observations": {
                "source": "ISRIC SoilGrids v2.0 + GEE (GSDE & He et al.)",
                "aggregated": aggregated,
                "raw_depths": soil_data.get("raw", {})
            },
            "climate": {
                "source": "Open-Meteo",
                "temperature_celsius": temp
            },
            "quefts_inputs": quefts_inputs,
            "estimated_supply": {
                "nitrogen": supply["N"],
                "phosphorus": supply["P"],
                "potassium": supply["K"]
            },
            "limitations": limitations
        }
    except Exception as e:
        logger.error(f"Error in quefts supply: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
