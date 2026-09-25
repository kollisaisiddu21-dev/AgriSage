import ee
from app.core.config import settings

class EarthEngineService:
    def __init__(self):
        self.project_id = settings.PROJECT_ID
        self._initialize_ee()

    def _initialize_ee(self):
        if not self.project_id:
            print("Earth Engine initialization skipped: PROJECT_ID not set.")
            return

        try:
            ee.Initialize(project=self.project_id)
            print("Earth Engine successfully initialized in API!")
        except Exception as e:
            print(f"Earth Engine initialization failed: {e}")

    def analyze_field(self, lat: float, lon: float) -> dict:
        try:
            print(f"Fetching satellite data for coordinates: {lat}, {lon}...")
            point = ee.Geometry.Point([lon, lat])
            
            # Pull Sentinel-2 imagery for the current year
            collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                          .filterBounds(point)
                          .filterDate('2026-01-01', '2026-12-31')
                          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                          .sort('system:time_start', False))
                          
            latest_image = collection.first()
            ndvi = latest_image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            
            # Calculate mean NDVI in a 100-meter radius
            buffer = point.buffer(100)
            mean_dict = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=buffer,
                scale=10 
            )
            
            ndvi_value = mean_dict.get('NDVI').getInfo()
            
            if ndvi_value is None:
                return {"status": "error", "message": "No clear satellite imagery found for these coordinates."}
                
            status_text = "Bare soil or sparse vegetation."
            if ndvi_value > 0.6:
                status_text = "Dense, healthy vegetation."
            elif ndvi_value > 0.3:
                status_text = "Moderate vegetation (could be early growth or stressed crops)."
                
            return {
                "latitude": lat,
                "longitude": lon,
                "ndvi_score": round(ndvi_value, 4),
                "vegetation_status": status_text,
                "status": "success"
            }
        except Exception as e:
            print(f"Satellite Error: {e}")
            return {"status": "error", "message": str(e)}

earth_engine_service = EarthEngineService()
