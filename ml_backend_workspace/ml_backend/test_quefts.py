import asyncio
from app.services.soil_provider import ISRICSoilGridsProvider
from app.services.climate_provider import OpenMeteoClimateProvider
from app.services.quefts_service import QueftsAdapter
import json

async def test_quefts():
    lat = 15.36
    lon = 75.12
    
    climate = OpenMeteoClimateProvider()
    soil = ISRICSoilGridsProvider()
    adapter = QueftsAdapter()
    
    try:
        temp = await climate.get_temperature(lat, lon)
        print(f"Temperature: {temp}")
        
        soil_data = await soil.get_soil_properties(lat, lon)
        print("Raw soil depths:", json.dumps(soil_data["raw"], indent=2))
        print("Aggregated soil:", json.dumps(soil_data["aggregated"], indent=2))
        
        inputs = adapter.transform_soilgrids(soil_data["aggregated"])
        print("QUEFTS inputs:", json.dumps(inputs, indent=2))
        
        supply = adapter.calculate_nut_supply(inputs, temp)
        print("Supply:", json.dumps(supply, indent=2))
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_quefts())
