import httpx
from abc import ABC, abstractmethod

class ClimateProvider(ABC):
    @abstractmethod
    async def get_temperature(self, lat: float, lon: float) -> float:
        pass

class OpenMeteoClimateProvider(ClimateProvider):
    async def get_temperature(self, lat: float, lon: float) -> float:
        # Fetching long-term annual average temperature (Climatology) from NASA POWER API.
        # QUEFTS model requires average growing season/annual temperature, NOT current real-time weather.
        url = f"https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=AG&longitude={lon}&latitude={lat}&format=JSON"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                # 'ANN' gives the Annual Average Temperature over the past 30-year climate period
                ann_temp = data["properties"]["parameter"]["T2M"]["ANN"]
                return float(ann_temp)
            except Exception as e:
                raise RuntimeError(f"Climate API error: {str(e)}")
