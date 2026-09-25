import numpy as np
from typing import Dict, Any, Optional

def approxfun(x: float, xp: list, yp: list) -> float:
    """
    R's approxfun with rule=2 equivalent using numpy.
    Extrapolates using the closest extreme value.
    """
    return float(np.interp(x, xp, yp))

def get_fn(ph: float) -> float:
    return approxfun(ph, [4.7, 7.0], [0.4, 1.0])

def get_fp(ph: float) -> float:
    return approxfun(
        ph, 
        [4.7, 5.0, 5.5, 6.0, 6.7, 7.0, 7.5, 8.0], 
        [0.02, 0.5, 0.875, 1.0, 1.0, 0.9775, 0.84, 0.02]
    )

def get_fk(ph: float) -> float:
    return approxfun(
        ph, 
        [4.5, 5.0, 6.0, 6.8], 
        [1.0, 0.8842312, 0.71, 0.6]
    )

class QueftsAdapter:
    """
    Transforms normalized soil data into QUEFTS inputs and calculates
    estimated available N, P, and K.
    """
    
    def transform_soilgrids(self, aggregated: Dict[str, float]) -> Dict[str, Optional[float]]:
        """
        Converts SoilGrids variables to QUEFTS standard units.
        SoilGrids: soc (dg/kg), phh2o (pH * 10), nitrogen (cg/kg)
        QUEFTS: soc (g/kg), pH (H2O), Kex (mmol/kg), Polsen (mg/kg), Ptotal (mg/kg)
        """
        inputs = {
            "pH": None,
            "SOC": None,
            "Kex": None,
            "Polsen": None,
            "Ptotal": None
        }
        
        if aggregated.get("phh2o") is not None:
            inputs["pH"] = aggregated["phh2o"] / 10.0
            
        if aggregated.get("soc") is not None:
            inputs["SOC"] = aggregated["soc"] / 10.0
            
        # P and K fetched from GEE (already in correct units: mg/kg and mmol/kg)
        if aggregated.get("ptotal") is not None:
            inputs["Ptotal"] = aggregated["ptotal"]
            
        if aggregated.get("polsen") is not None:
            inputs["Polsen"] = aggregated["polsen"]
            
        if aggregated.get("kex") is not None:
            inputs["Kex"] = aggregated["kex"]
        
        return inputs

    def calculate_nut_supply(self, inputs: Dict[str, Optional[float]], temp: float) -> Dict[str, Optional[float]]:
        """
        Python implementation of Rquefts::nutSupply2
        Returns N_supply, P_supply, K_supply (kg/ha)
        """
        supply = {
            "N": None,
            "P": None,
            "K": None
        }
        
        ph = inputs.get("pH")
        soc = inputs.get("SOC")
        polsen = inputs.get("Polsen")
        ptotal = inputs.get("Ptotal")
        kex = inputs.get("Kex")
        
        # Nitrogen Supply
        if ph is not None and soc is not None and temp is not None:
            teff_n = 2 * (2 ** ((temp - 9) / 9))
            fN = get_fn(ph)
            supply["N"] = max(0.0, fN * teff_n * soc)
            
        # Phosphorus Supply
        if ph is not None and polsen is not None and ptotal is not None:
            fP = get_fp(ph)
            supply["P"] = max(0.0, fP * 0.014 * ptotal + 0.5 * polsen)
            
        # Potassium Supply
        if ph is not None and soc is not None and kex is not None:
            fK = get_fk(ph)
            supply["K"] = max(0.0, (fK * 400 * kex) / (2 + 0.9 * soc))
            
        return supply
