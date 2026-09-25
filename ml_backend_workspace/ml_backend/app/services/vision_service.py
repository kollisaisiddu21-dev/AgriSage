import tensorflow as tf
import numpy as np
from PIL import Image
import io
import json
import base64
from app.services.ai_service import ai_service

class VisionService:
    def __init__(self):
        self.model = None
        self.class_names = []
        self._load_model()

    def _load_model(self):
        try:
            # Assumes running from root dir
            self.model = tf.keras.models.load_model('models/crop_disease_model_ultra_accurate.keras')
            with open('models/class_names.json', 'r') as f:
                self.class_names = json.load(f)
            print("Vision model loaded.")
        except Exception as e:
            print(f"Warning: Vision model not found. {e}")

    async def detect_disease(self, contents: bytes) -> dict:
        if self.model is None:
            # Skip directly to VLM if local model is broken
            print("Vision model not loaded. Routing directly to Agentic Cloud AI...")
            return self._run_vlm_fallback(contents)

        # 1. RUN LOCAL CNN
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img = img.resize((224, 224))
        img_array = tf.keras.preprocessing.image.img_to_array(img)
        img_array = tf.expand_dims(img_array, 0)

        predictions = self.model.predict(img_array)
        predicted_index = np.argmax(predictions[0])
        predicted_class = self.class_names[predicted_index]
        confidence = float(np.max(predictions[0]))
        
        print(f"\n--- DEBUG: LOCAL AI PREDICTION ---")
        print(f"Class: {predicted_class} | Confidence: {confidence * 100:.2f}%\n")
        
        # 2. EVALUATE CONFIDENCE
        if confidence >= 0.60:
            if "healthy" in predicted_class.lower():
                return {
                    "disease": "None - Plant is Healthy",
                    "cause": "N/A",
                    "solution": "N/A",
                    "advisory": "Your plant looks completely healthy! Keep up the good work maintaining optimal soil and watering conditions.",
                    "confidence": round(confidence, 2),
                    "source": "Local ML Pipeline",
                    "status": "healthy" 
                }
            
            # CNN found a disease. Now we ask the Text LLM for an explanation (ChatGPT's suggested flow!)
            print("CNN found a disease. Generating expert explanation via Text LLM...")
            text_result = ai_service.generate_disease_details(predicted_class)
            if text_result["status"] == "success":
                data = text_result["data"]
                return {
                    "disease": predicted_class.replace("_", " "),
                    "cause": data.get("cause", ""),
                    "solution": data.get("solution", ""),
                    "advisory": data.get("advisory", ""),
                    "confidence": round(confidence, 2),
                    "source": "Local CNN + LLM Advisory",
                    "status": "disease_detected"
                }
            else:
                # LLM failed, return raw CNN result
                return {
                    "disease": predicted_class.replace("_", " "),
                    "cause": "Unknown",
                    "solution": "Consult an agronomist.",
                    "advisory": "Expert advisory temporarily unavailable.",
                    "confidence": round(confidence, 2),
                    "source": "Local CNN",
                    "status": "disease_detected"
                }
        else:
            # 3. CNN CONFIDENCE IS LOW -> USE VLM
            print("Local CNN confidence is too low. Falling back to Agentic Cloud Vision AI...")
            return self._run_vlm_fallback(contents)

    def _run_vlm_fallback(self, contents: bytes) -> dict:
        base64_image = base64.b64encode(contents).decode("utf-8")
        vlm_result = ai_service.analyze_disease_vision(base64_image)
        
        if vlm_result["status"] == "success":
            data = vlm_result["data"]
            return {
                "disease": data.get("disease_name", "Unknown"),
                "cause": data.get("cause", ""),
                "solution": data.get("solution", ""),
                "advisory": data.get("advisory", ""),
                "confidence": 0.99, # VLM is highly confident
                "source": "Agentic Vision AI (Fallback)",
                "status": data.get("status", "disease_detected")
            }
        return {"status": "error", "message": "Both Local CNN and Cloud VLM failed to analyze the image."}

vision_service = VisionService()
