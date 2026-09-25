import time
import logging
import json
import random
from typing import List, Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, wait_random
from openai import OpenAI, RateLimitError, APIError, APIConnectionError, InternalServerError
import requests
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProviderConfig:
    def __init__(self, name: str, model_id: str, api_key: str, base_url: str, priority: int, capabilities: Dict[str, bool]):
        self.name = name
        self.model_id = model_id
        self.api_key = api_key
        self.base_url = base_url
        self.priority = priority
        self.capabilities = capabilities
        
        # Health state
        self.success_count = 0
        self.failure_count = 0
        self.timeout_count = 0
        self.rate_limit_count = 0
        self.cooldown_until = 0
        
        self.client = None
        if self.base_url and self.api_key:
            self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)

class LLMRouter:
    def __init__(self):
        self.providers: List[ProviderConfig] = []
        self._init_providers()

    def _init_providers(self):
        # ----------------------------------------------------
        # FALLBACK 1: GEMINI (Text & Vision)
        # ----------------------------------------------------
        if settings.GEMINI_API_KEY:
            self.providers.append(ProviderConfig(
                name="gemini_pro",
                model_id="gemini-2.5-pro",
                api_key=settings.GEMINI_API_KEY,
                base_url="",
                priority=10,
                capabilities={"text": True, "vision": True, "structured_output": True, "tool_calling": True}
            ))
            self.providers.append(ProviderConfig(
                name="gemini_flash",
                model_id="gemini-2.5-flash",
                api_key=settings.GEMINI_API_KEY,
                base_url="",
                priority=11,
                capabilities={"text": True, "vision": True, "structured_output": True, "tool_calling": True}
            ))

        # ----------------------------------------------------
        # FALLBACK 2 (Vision): Qwen-VL (via OpenRouter)
        # ----------------------------------------------------
        if settings.OPENROUTER_API_KEY:
            self.providers.append(ProviderConfig(
                name="openrouter_qwen_vl",
                model_id="qwen/qwen-2.5-vl-72b-instruct",
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                priority=20,
                capabilities={"text": False, "vision": True, "structured_output": True, "tool_calling": False}
            ))

        # ----------------------------------------------------
        # FALLBACK 2 (Text) / 3 (Vision): Groq / Llama Vision
        # ----------------------------------------------------
        if settings.GROQ_API_KEY:
            self.providers.append(ProviderConfig(
                name="groq_text",
                model_id="llama3-8b-8192",
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
                priority=20,  # 2nd for text
                capabilities={"text": True, "vision": False, "structured_output": True, "tool_calling": True}
            ))
            self.providers.append(ProviderConfig(
                name="groq_vision",
                model_id="llama-3.2-90b-vision-preview",
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
                priority=30,  # 3rd for vision
                capabilities={"text": False, "vision": True, "structured_output": True, "tool_calling": False}
            ))

        # ----------------------------------------------------
        # FALLBACK 3 (Text) / 4 (Vision): OpenRouter Fallback
        # ----------------------------------------------------
        if settings.OPENROUTER_API_KEY:
            self.providers.append(ProviderConfig(
                name="openrouter_fallback",
                model_id="openai/gpt-4o-mini",
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                priority=30, # 3rd for text
                capabilities={"text": True, "vision": False, "structured_output": True, "tool_calling": True}
            ))
            self.providers.append(ProviderConfig(
                name="openrouter_vision_fallback",
                model_id="openai/gpt-4o-mini",
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                priority=40, # 4th for vision
                capabilities={"text": False, "vision": True, "structured_output": True, "tool_calling": True}
            ))

        # ----------------------------------------------------
        # FALLBACK 4 (Text): Cloudflare Workers AI
        # ----------------------------------------------------
        if settings.CLOUDFLARE_ACCOUNT_ID and settings.CLOUDFLARE_API_TOKEN:
            cf_url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/ai/v1"
            self.providers.append(ProviderConfig(
                name="cloudflare",
                model_id="@cf/meta/llama-3-8b-instruct",
                api_key=settings.CLOUDFLARE_API_TOKEN,
                base_url=cf_url,
                priority=40,
                capabilities={"text": True, "vision": False, "structured_output": False, "tool_calling": False}
            ))

        # ----------------------------------------------------
        # FALLBACK 5: Local (Ollama)
        # ----------------------------------------------------
        self.providers.append(ProviderConfig(
            name="local_text",
            model_id="llama3.1",
            api_key="ollama", # placeholder
            base_url=settings.LOCAL_API_URL,
            priority=50,
            capabilities={"text": True, "vision": False, "structured_output": True, "tool_calling": True}
        ))
        self.providers.append(ProviderConfig(
            name="local_vision",
            model_id="llama3.2-vision",
            api_key="ollama", # placeholder
            base_url=settings.LOCAL_API_URL,
            priority=50,
            capabilities={"text": False, "vision": True, "structured_output": True, "tool_calling": False}
        ))

        # Sort all providers by priority globally
        self.providers.sort(key=lambda p: p.priority)

    def _get_healthy_providers(self, required_capabilities: List[str] = None) -> List[ProviderConfig]:
        now = time.time()
        healthy = []
        for p in self.providers:
            # Check cooldown
            if now < p.cooldown_until:
                continue
            
            # Check capabilities
            if required_capabilities:
                has_caps = all(p.capabilities.get(cap, False) for cap in required_capabilities)
                if not has_caps:
                    continue
                    
            healthy.append(p)
            
        # Sort again by priority to be safe
        healthy.sort(key=lambda x: x.priority)
        return healthy

    def _execute_openai_request(self, provider: ProviderConfig, messages: List[dict], response_format: dict = None) -> str:
        # We will use tenacity for retry logic within this function
        @retry(
            retry=retry_if_exception_type((RateLimitError, APIConnectionError, InternalServerError)),
            wait=wait_exponential(multiplier=1, min=1, max=10) + wait_random(0, 1),
            stop=stop_after_attempt(3),
            reraise=True
        )
        def _make_call():
            kwargs = {
                "model": provider.model_id,
                "messages": messages,
                "max_tokens": 8192
            }
            if response_format:
                # Basic JSON object response format
                kwargs["response_format"] = {"type": "json_object"}

            response = provider.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content

        return _make_call()

    def _execute_gemini_raw_request(self, provider: ProviderConfig, messages: List[dict]) -> str:
        # Convert standard OpenAI messages format to Gemini format
        gemini_contents = []
        system_instruction = None
        
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = {"parts": [{"text": msg["content"]}]}
            elif msg["role"] == "user":
                # Check if it has vision parts
                if isinstance(msg["content"], list):
                    parts = []
                    for part in msg["content"]:
                        if part["type"] == "text":
                            parts.append({"text": part["text"]})
                        elif part["type"] == "image_url":
                            # Extremely simplified mapping for base64
                            b64_data = part["image_url"]["url"].split(",")[-1]
                            parts.append({
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": b64_data
                                }
                            })
                    gemini_contents.append({"role": "user", "parts": parts})
                else:
                    gemini_contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
            elif msg["role"] == "assistant":
                gemini_contents.append({"role": "model", "parts": [{"text": str(msg.get("content", ""))}]})

        payload = {
            "contents": gemini_contents,
            "generationConfig": {
                "maxOutputTokens": 8192
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{provider.model_id}:generateContent?key={provider.api_key}"

        @retry(
            retry=retry_if_exception_type(requests.exceptions.RequestException),
            wait=wait_exponential(multiplier=1, min=1, max=10) + wait_random(0, 1),
            stop=stop_after_attempt(3),
            reraise=True
        )
        def _make_call():
            res = requests.post(url, json=payload, timeout=45)
            if res.status_code in [429, 500, 502, 503, 504]:
                res.raise_for_status() # Trigger retry
                
            res_data = res.json()
            if "error" in res_data:
                # If it's a 400 (Bad request), don't retry, just fail this provider
                if res.status_code == 400:
                    raise ValueError(f"Gemini Bad Request: {res_data['error']}")
                res.raise_for_status()
                
            return res_data["candidates"][0]["content"]["parts"][0]["text"]
            
        return _make_call()

    def generate_content(self, messages: List[dict], required_capabilities: List[str] = None, response_format: dict = None) -> dict:
        """
        messages: Standard OpenAI format 
        [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Hello!"}
        ]
        """
        healthy_providers = self._get_healthy_providers(required_capabilities)
        
        if not healthy_providers:
            return {
                "success": False,
                "error": "No providers available with the required capabilities.",
                "retryable": False
            }

        for provider in healthy_providers:
            start_time = time.time()
            try:
                logger.info(f"Attempting to route to {provider.name} ({provider.model_id})")
                
                # Execute request
                if provider.name.startswith("gemini"):
                    result = self._execute_gemini_raw_request(provider, messages)
                else:
                    result = self._execute_openai_request(provider, messages, response_format)
                
                # Success
                provider.success_count += 1
                latency = int((time.time() - start_time) * 1000)
                
                logger.info(f"Success! Provider: {provider.name}, Latency: {latency}ms")
                
                return {
                    "success": True,
                    "text": result,
                    "provider": provider.name,
                    "model": provider.model_id,
                    "latency_ms": latency
                }
                
            except Exception as e:
                latency = int((time.time() - start_time) * 1000)
                provider.failure_count += 1
                logger.warning(f"Provider {provider.name} failed. Latency: {latency}ms. Error: {str(e)}")
                
                # Determine if we should cooldown the provider
                # For non-retryable errors (e.g. ValueError / 400), we don't cooldown, just move to next
                if isinstance(e, ValueError):
                    pass
                else:
                    provider.rate_limit_count += 1
                    # Cooldown for 30 seconds
                    provider.cooldown_until = time.time() + 30
                    logger.info(f"Provider {provider.name} placed in cooldown for 30 seconds.")
                
                continue # Try next provider

        return {
            "success": False,
            "error": "AI service temporarily unavailable. All configured providers failed.",
            "retryable": True
        }

llm_router = LLMRouter()
