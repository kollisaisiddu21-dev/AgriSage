import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

test_models = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-pro-latest",
    "gemini-flash-latest"
]

payload = {
    "contents": [{"role": "user", "parts": [{"text": "Say yes"}]}]
}

for model in test_models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    try:
        res = requests.post(url, json=payload, timeout=10)
        print(f"{model}: {res.status_code}")
        if res.status_code == 200:
            print("Success! Response:", res.json()["candidates"][0]["content"]["parts"][0]["text"])
    except Exception as e:
        print(f"{model}: Error: {str(e)}")
