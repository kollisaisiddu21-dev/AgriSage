import httpx
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, List

class SoilProvider(ABC):
    @abstractmethod
    async def get_soil_properties(self, lat: float, lon: float) -> Dict[str, Any]:
        pass

class ISRICSoilGridsProvider(SoilProvider):
    async def get_soil_properties(self, lat: float, lon: float) -> Dict[str, Any]:
        import time
        start_time = time.time()
        url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
        params = {
            "property": ["nitrogen", "phh2o", "soc", "clay", "sand", "silt", "bdod"],
            "depth": ["0-5cm", "5-15cm", "15-30cm"],
            "value": ["mean"]
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            async def _fetch(fetch_lat, fetch_lon):
                p = params.copy()
                p["lat"] = fetch_lat
                p["lon"] = fetch_lon
                try:
                    response = await client.get(url, params=p)
                    response.raise_for_status()
                    return self._parse_and_aggregate(response.json())
                except Exception:
                    return None

            while time.time() - start_time < 20:
                # Initial attempt
                res = await _fetch(lat, lon)
                if res and res.get("aggregated", {}).get("soc") is not None:
                    res["actual_lat"] = lat
                    res["actual_lon"] = lon
                    return res
                
                # Spiral search (radius in approx kilometers, 1 deg ~ 111km)
                # 0.01 deg is ~1.1km
                offsets = [
                    (0.01, 0), (-0.01, 0), (0, 0.01), (0, -0.01),
                    (0.01, 0.01), (-0.01, -0.01), (0.01, -0.01), (-0.01, 0.01),
                    (0.03, 0), (-0.03, 0), (0, 0.03), (0, -0.03),
                    (0.05, 0), (-0.05, 0), (0, 0.05), (0, -0.05)
                ]
                
                for i in range(0, len(offsets), 4):
                    batch = offsets[i:i+4]
                    tasks = [_fetch(lat + dlat, lon + dlon) for dlat, dlon in batch]
                    results = await asyncio.gather(*tasks)
                    for r, (dlat, dlon) in zip(results, batch):
                        if r and r.get("aggregated", {}).get("soc") is not None:
                            r["actual_lat"] = lat + dlat
                            r["actual_lon"] = lon + dlon
                            return r
                
                # If we get here, neither the exact location nor the spiral search worked.
                # Sleep briefly before trying the exact location again
                await asyncio.sleep(2)
            
            # If 20 seconds elapse without a successful return
            raise RuntimeError("Could not fetch info, try again")

    def _parse_and_aggregate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates thickness-weighted aggregation for 0-30cm:
        0-5 cm: weight 5
        5-15 cm: weight 10
        15-30 cm: weight 15
        """
        properties = {}
        raw_depths = {}
        
        if "properties" not in data or "layers" not in data["properties"]:
            return {"aggregated": properties, "raw": raw_depths}

        layers = data["properties"]["layers"]
        
        weights = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}
        
        for layer in layers:
            prop_name = layer["name"]
            depths = layer.get("depths", [])
            
            raw_depths[prop_name] = {}
            weighted_sum = 0
            weight_used = 0
            
            for depth in depths:
                label = depth.get("label")
                mean_val = depth.get("values", {}).get("mean")
                
                raw_depths[prop_name][label] = mean_val
                
                if mean_val is not None and label in weights:
                    w = weights[label]
                    weighted_sum += mean_val * w
                    weight_used += w
                    
            if weight_used > 0:
                properties[prop_name] = weighted_sum / weight_used
            else:
                properties[prop_name] = None
                
        return {
            "aggregated": properties,
            "raw": raw_depths,
            "unit_measure": {layer["name"]: layer.get("unit_measure", {}) for layer in layers}
        }

import ee
from app.core.config import settings

class GEESoilProvider(SoilProvider):
    """
    Provider that fetches GSDE (Total P, Exchangeable K) and He et al. (Olsen P) 
    from Google Earth Engine assets.
    """
    def __init__(self):
        # We assume ee is already initialized in earth_engine_service,
        # but just in case, we could initialize here. 
        # For this architecture, we'll assume it's initialized globally or we handle it gracefully.
        pass

    async def get_soil_properties(self, lat: float, lon: float) -> Dict[str, Any]:
        properties = {
            "ptotal": None,
            "kex": None,
            "polsen": None
        }
        
        try:
            point = ee.Geometry.Point([lon, lat])
            
            # Fetch GSDE Total P
            if settings.GEE_ASSET_GSDE_PTOTAL:
                try:
                    img_ptotal = ee.Image(settings.GEE_ASSET_GSDE_PTOTAL)
                    ptotal_dict = img_ptotal.reduceRegion(
                        reducer=ee.Reducer.mean(),
                        geometry=point,
                        scale=1000
                    ).getInfo()
                    
                    # Assuming the band name is 'b1' or we take the first value
                    val = list(ptotal_dict.values())[0] if ptotal_dict else None
                    properties["ptotal"] = val
                except Exception as e:
                    print(f"Error fetching Ptotal from GEE: {e}")

            # Fetch GSDE Kex
            if settings.GEE_ASSET_GSDE_KEX:
                try:
                    img_kex = ee.Image(settings.GEE_ASSET_GSDE_KEX)
                    kex_dict = img_kex.reduceRegion(
                        reducer=ee.Reducer.mean(),
                        geometry=point,
                        scale=1000
                    ).getInfo()
                    
                    val = list(kex_dict.values())[0] if kex_dict else None
                    # GSDE EXK is stored as cmol/kg scaled by 100 (scaling factor 0.01).
                    # Actual cmol/kg = val / 100.
                    # QUEFTS Kex is in mmol/kg (1 cmol = 10 mmol).
                    # Therefore, kex = (val / 100) * 10 = val / 10.
                    properties["kex"] = val / 10.0 if val is not None else None
                except Exception as e:
                    print(f"Error fetching Kex from GEE: {e}")
                    
            # Fetch Olsen P
            if settings.GEE_ASSET_OLSEN_P:
                try:
                    img_polsen = ee.Image(settings.GEE_ASSET_OLSEN_P)
                    polsen_dict = img_polsen.reduceRegion(
                        reducer=ee.Reducer.mean(),
                        geometry=point,
                        scale=10000
                    ).getInfo()
                    
                    val = list(polsen_dict.values())[0] if polsen_dict else None
                    properties["polsen"] = val
                except Exception as e:
                    print(f"Error fetching Polsen from GEE: {e}")
                    
        except Exception as e:
            print(f"GEE Provider error: {e}")
            
        # Fallback values if GEE is not configured, fails to return data, or returns a negative NoData value (like -100)
        # This prevents the app from returning 0 for P and K when users don't have their own GEE assets deployed or hit an empty pixel
        if properties["ptotal"] is None or properties["ptotal"] < 0:
            properties["ptotal"] = 600.0  # mg/kg (typical agricultural soil)
        if properties["polsen"] is None or properties["polsen"] < 0:
            properties["polsen"] = 15.0   # mg/kg
        if properties["kex"] is None or properties["kex"] < 0:
            properties["kex"] = 4.5       # mmol/kg
            
        return {"aggregated": properties, "raw": properties}
