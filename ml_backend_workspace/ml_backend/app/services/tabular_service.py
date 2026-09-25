import joblib
import pandas as pd
from app.schemas.crop import FarmData

class TabularService:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            # Assumes running from root dir
            self.model = joblib.load('models/crop_rf_model.pkl')
            print("Tabular model loaded.")
        except Exception as e:
            print(f"Warning: Tabular model not found. {e}")

    def predict_crop(self, data: FarmData) -> str:
        if self.model is None:
            raise RuntimeError("Model is not loaded.")
        
        input_df = pd.DataFrame([[
            data.N, data.P, data.K, data.temperature, 
            data.humidity, data.ph, data.rainfall
        ]], columns=['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'])
        
        prediction = self.model.predict(input_df)[0]
        return prediction

tabular_service = TabularService()
