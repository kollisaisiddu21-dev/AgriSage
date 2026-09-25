import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

payload = {
    "contents": [{"role": "user", "parts": [{"text": "Say hello world in JSON: {\\"msg\\": \\"hello world\\"}"}]}],
    "systemInstruction": {"parts": [{"text": "Return JSON only."}]},
    "generationConfig": {"responseMimeType": "application/json"}
}

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
try:
    res = requests.post(url, json=payload, timeout=10)
    print("Status:", res.status_code)
    print("Text:", res.text)
except Exception as e:
    print("Error:", str(e))
