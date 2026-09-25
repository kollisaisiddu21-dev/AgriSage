import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

test_models = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-pro-latest",
    "gemini-flash-latest"
]

payload = {
    "contents": [{"role": "user", "parts": [{"text": "Say yes"}]}]
}

print("Testing Gemini Models with REST API...")
for model in test_models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    try:
        res = requests.post(url, json=payload, timeout=10)
        print(f"[{model}] Status: {res.status_code}")
        if res.status_code == 200:
            print(f"  -> Success: {res.json()['candidates'][0]['content']['parts'][0]['text'].strip()}")
        else:
            print(f"  -> Error: {res.text[:100]}")
    except Exception as e:
        print(f"[{model}] Error: {str(e)}")
