import requests
import json

payload = {
  "N": 90,
  "P": 42,
  "K": 43,
  "temperature": 25,
  "humidity": 60,
  "ph": 6.5,
  "rainfall": 100
}

try:
    res = requests.post("http://127.0.0.1:8000/predict-crop", json=payload)
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(str(e))
