import json
from typing import List, Dict, Any
from app.services.llm_router import llm_router
from app.services.rag_service import rag_service

class AIService:
    def generate_disease_details(self, disease_name: str) -> dict:
        prompt = (
            f"You are an expert agricultural AI. A local ML model has identified the plant disease as '{disease_name}'. "
            "Return a JSON object with exactly three keys:\n"
            "1. 'cause': Detailed explanation of what causes this disease (e.g., fungi, pests, weather).\n"
            "2. 'solution': Step-by-step actionable remedies or treatments.\n"
            "3. 'advisory': A 2-3 sentence summary of the situation."
        )
        messages = [{"role": "user", "content": prompt}]
        
        result = llm_router.generate_content(
            messages=messages,
            required_capabilities=["structured_output"],
            response_format={"type": "json_object"}
        )
        
        if result["success"]:
            try:
                text = result["text"].strip()
                if text.startswith("```json"): text = text[7:]
                if text.endswith("```"): text = text[:-3]
                return {"status": "success", "data": json.loads(text)}
            except Exception as e:
                return {"status": "error", "message": f"Failed to parse JSON: {e}"}
        return {"status": "error", "message": result["error"]}

    def analyze_disease_vision(self, base64_image: str) -> dict:
        prompt = (
            "You are an expert agricultural AI pathologist. Analyze the uploaded image of a plant/leaf. "
            "You must return a JSON object with exactly three keys:\n"
            "1. 'status': must be either 'healthy' if the plant looks completely healthy, or 'disease_detected' if you spot any issues.\n"
            "2. 'disease_name': The specific name of the disease (or 'None' if healthy).\n"
            "3. 'cause': Detailed explanation of what causes this disease (e.g., fungi, pests, weather). If healthy, write 'N/A'.\n"
            "4. 'solution': Step-by-step actionable remedies or treatments. If healthy, write 'N/A'.\n"
            "5. 'advisory': A 2-3 sentence extremely positive and encouraging response if healthy. If diseased, a short summary of the situation."
        )
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ]
        
        # llm_router handles sequential fallbacks automatically!
        result = llm_router.generate_content(
            messages=messages,
            required_capabilities=["vision", "structured_output"],
            response_format={"type": "json_object"}
        )
        
        if result["success"]:
            try:
                text = result["text"].strip()
                if text.startswith("```json"): text = text[7:]
                if text.endswith("```"): text = text[:-3]
                data = json.loads(text)
                return {"status": "success", "data": data}
            except Exception as e:
                return {"status": "error", "message": f"Failed to parse JSON: {e}"}
        else:
            return {"status": "error", "message": result["error"]}

    def generate_advisory(self, ml_results: dict, language: str, user_query: str = None, chat_history: List[dict] = None) -> dict:
        messages = []
        
        # Extract keywords from attached ML tests to augment RAG search
        ml_keywords = ""
        if "attached_ml_tests" in ml_results:
            for test in ml_results.get("attached_ml_tests", []):
                if test.get("type") == "disease_detection":
                    disease = test.get("results", {}).get("disease", "")
                    if disease: ml_keywords += f" {disease}"
                elif test.get("type") == "crop_recommendation":
                    crop = test.get("results", {}).get("crop", "")
                    if not crop: crop = test.get("results", {}).get("recommended_crop", "")
                    if crop: ml_keywords += f" {crop}"

        # Retrieve authoritative context using RAG
        search_query = f"{user_query} {ml_keywords}".strip() if user_query else f"{str(ml_results)} {ml_keywords}"
        rag_context = rag_service.retrieve_context(search_query)
        
        context_block = ""
        if rag_context:
            context_block = f"\nHere is authoritative agricultural reference information to base your advice on:\n{rag_context}\n"

        system_prompt = f"""
        You are an expert agricultural advisor working in India. 
        Here is the current AI prediction data for the farm, including ML tests and weather conditions: {json.dumps(ml_results)}
        {context_block}
        
        IMPORTANT WEATHER GUIDELINES:
        - Use the 'seasonal' temperature and rainfall data when analyzing long-term crop recommendations.
        - Use the 'current' and 7-day 'forecast' data when answering questions about irrigation scheduling, immediate pest risks, or short-term actions.

        CRITICAL: Translate your final output entirely into {language}.
        Base your advice on the reference information provided if applicable. Keep responses highly professional, actionable, and specific to the farmer's situation. Do not give generic LLM answers.
        """
        messages.append({"role": "system", "content": system_prompt})
        
        # Append history if provided
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg.get("role", "user"), 
                    "content": msg.get("content", "")
                })
        
        # Append current query, or a default prompt if none
        if user_query:
            messages.append({"role": "user", "content": user_query})
        else:
            default_prompt = "Write a highly detailed and in-depth advisory for the farmer. Explain the implications of the data, provide step-by-step actionable recommendations, and outline long-term best practices based on the provided reference information."
            messages.append({"role": "user", "content": default_prompt})
        
        result = llm_router.generate_content(
            messages=messages,
            required_capabilities=[]
        )
        
        if result["success"]:
            return {"status": "success", "advisory": result["text"], "language": language}
        else:
            return {"status": "error", "message": result["error"]}

    def generate_crop_recommendations(self, soil_data: dict) -> dict:
        messages = [
            {
                "role": "system",
                "content": "You are an expert agronomist AI. You must return a JSON object with a single key 'crops' containing a list of exactly 8-12 objects. You must provide exactly 2-3 crops for EACH of the following 4 categories: 'Grains', 'Fruits', 'Vegetables', and 'Flowers/Cash Crops'. Each object must have 'category' (string), 'crop' (string name), 'percentage' (integer realistic success chance between 60-98), and 'reason' (a short 1-2 sentence explanation of why this crop is scientifically recommended for these conditions).\nCRITICAL RULES:\n1. You MUST ONLY recommend crops that are actively sown or planted in the provided 'current_month_for_planting' in India. Do not recommend crops (like mangoes) if this is the wrong season to sow them!\n2. Before recommending, consider past agricultural data and historical farming patterns. Analyze which crops are traditionally and successfully grown in and around Indian locations that match this specific soil and weather profile."
            },
            {
                "role": "user",
                "content": f"Based on the following ground conditions (Note: N, P, K values are in kg/ha) and current month, suggest the most suitable seasonal crops spanning the 4 categories (Grains, Fruits, Vegetables, Flowers/Cash Crops) that will thrive in this environment.\n\nGround Conditions & Seasonality:\n{json.dumps(soil_data, indent=2)}"
            }
        ]
        
        result = llm_router.generate_content(
            messages=messages,
            required_capabilities=["structured_output"],
            response_format={"type": "json_object"}
        )
        
        if result["success"]:
            try:
                # Clean up markdown code blocks if the LLM wrapped it
                text = result["text"].strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                    
                data = json.loads(text)
                return {"status": "success", "crops": data.get("crops", [])}
            except Exception as e:
                return {"status": "error", "message": f"Failed to parse JSON: {e}"}
        else:
            return {"status": "error", "message": result["error"]}

    def generate_field_analysis(self, ndvi_score: float, status: str) -> dict:
        messages = [
            {
                "role": "system",
                "content": "You are an expert agronomist. Provide a 2-3 sentence actionable insight for a farmer based on their satellite NDVI score."
            },
            {
                "role": "user",
                "content": f"The NDVI score is {ndvi_score} ({status}). What does this mean for the crops and what should the farmer do?"
            }
        ]
        
        result = llm_router.generate_content(
            messages=messages,
            required_capabilities=[]
        )
        
        if result["success"]:
            return {"status": "success", "analysis": result["text"]}
        else:
            return {"status": "error", "message": result["error"]}

ai_service = AIService()
