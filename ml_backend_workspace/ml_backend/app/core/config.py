import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "AgriN Track 4 - Multi-Modal AI API"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    SAMBANOVA_API_KEY: str = os.getenv("SAMBANOVA_API_KEY", "")
    PROJECT_ID: str = os.getenv("PROJECT_ID", "")
    
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_API_TOKEN: str = os.getenv("CLOUDFLARE_API_TOKEN", "")
    LOCAL_API_URL: str = os.getenv("LOCAL_API_URL", "http://localhost:11434/v1")
    
    # GEE Asset IDs for Composite Soil Datasets
    GEE_ASSET_GSDE_PTOTAL: str = os.getenv("GEE_ASSET_GSDE_PTOTAL", "") # e.g. 'projects/your-project/assets/GSDE_Ptotal'
    GEE_ASSET_GSDE_KEX: str = os.getenv("GEE_ASSET_GSDE_KEX", "")       # e.g. 'projects/your-project/assets/GSDE_EXK'
    GEE_ASSET_OLSEN_P: str = os.getenv("GEE_ASSET_OLSEN_P", "")         # e.g. 'projects/your-project/assets/He_Olsen_P'

settings = Settings()
