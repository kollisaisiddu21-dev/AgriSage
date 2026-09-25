from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class AdvisoryRequest(BaseModel):
    ml_results: dict
    language: str
    user_query: Optional[str] = None
    chat_history: Optional[List[Dict[str, Any]]] = None
