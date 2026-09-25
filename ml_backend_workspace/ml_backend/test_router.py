import sys
import os

# Ensure app module can be found
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.llm_router import llm_router
from app.core.config import settings

def test_fallback():
    print("\n========== TESTING TEXT PIPELINE ==========")
    messages = [{"role": "user", "content": "Say 'hello world' and nothing else."}]
    
    print("\n1. Normal request (Expected: Gemini Pro)")
    res = llm_router.generate_content(messages, required_capabilities=["text"])
    print(f"Success: {res['success']} | Provider: {res.get('provider')} | Model: {res.get('model')} | Latency: {res.get('latency_ms')}ms")

    print("\n2. Simulating Gemini Outage (Expected: Groq Llama 3)")
    for p in llm_router.providers:
        if "gemini" in p.name:
            p.api_key = "invalid"
            p.cooldown_until = 0 # reset any cooldowns to attempt again and fail fast

    res = llm_router.generate_content(messages, required_capabilities=["text"])
    print(f"Success: {res['success']} | Provider: {res.get('provider')} | Model: {res.get('model')} | Latency: {res.get('latency_ms')}ms")
    
    print("\n3. Simulating Groq Outage (Expected: OpenRouter Fallback)")
    for p in llm_router.providers:
        if "groq" in p.name:
            p.api_key = "invalid"
            p.cooldown_until = 0
            
    res = llm_router.generate_content(messages, required_capabilities=["text"])
    print(f"Success: {res['success']} | Provider: {res.get('provider')} | Model: {res.get('model')} | Latency: {res.get('latency_ms')}ms")

    print("\n4. Simulating OpenRouter Outage (Expected: Cloudflare Workers AI)")
    for p in llm_router.providers:
        if "openrouter" in p.name:
            p.api_key = "sk-or-v1-invalid"
            p.cooldown_until = 0
            
    res = llm_router.generate_content(messages, required_capabilities=["text"])
    print(f"Success: {res['success']} | Provider: {res.get('provider')} | Model: {res.get('model')} | Latency: {res.get('latency_ms')}ms")

    print("\n========== TESTING VISION PIPELINE ==========")
    vision_messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": "What is this?"},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP/"}} # fake small image
        ]
    }]

    print("\n1. Simulating Gemini & OpenRouter Qwen-VL Outages (Expected: Groq Llama Vision)")
    # We already invalidated Gemini and OpenRouter above!
    for p in llm_router.providers:
        p.cooldown_until = 0 # reset all cooldowns
        
    res = llm_router.generate_content(vision_messages, required_capabilities=["vision"])
    print(f"Success: {res['success']} | Provider: {res.get('provider')} | Model: {res.get('model')} | Latency: {res.get('latency_ms')}ms")

if __name__ == "__main__":
    test_fallback()
