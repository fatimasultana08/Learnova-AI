import os
import logging
import requests
from dotenv import load_dotenv
from typing import Dict, Any, Optional

load_dotenv()

logger = logging.getLogger(__name__)

WATSONX_API_KEY = os.environ.get("WATSONX_API_KEY", "")
WATSONX_PROJECT_ID = os.environ.get("WATSONX_PROJECT_ID", "")
WATSONX_URL = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_MODEL_ID = os.environ.get("WATSONX_MODEL_ID", "ibm/granite-13b-instruct-v2")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

# Ordered fallback list — tried in sequence if a model is unavailable
_GEMINI_FALLBACK_MODELS = [
    "models/gemini-3.5-flash",
    "models/gemini-3.8-flash",
    "models/gemini-3.1-flash-lite",
    "models/gemini-flash-latest",
]


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------

def get_active_provider() -> str:
    if WATSONX_API_KEY and WATSONX_PROJECT_ID:
        return "watsonx"
    elif OPENAI_API_KEY:
        return "openai"
    elif GEMINI_API_KEY:
        return "gemini"
    return "dev"


def provider_status() -> Dict[str, Any]:
    provider = get_active_provider()
    return {
        "active_provider": provider,
        "watsonx_configured": bool(WATSONX_API_KEY and WATSONX_PROJECT_ID),
        "openai_configured": bool(OPENAI_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY),
        "dev_mode": provider == "dev",
        "watsonx_model": WATSONX_MODEL_ID if WATSONX_API_KEY else None,
        "watsonx_url": WATSONX_URL if WATSONX_API_KEY else None,
    }


# ---------------------------------------------------------------------------
# IBM watsonx.ai
# ---------------------------------------------------------------------------

def _get_watsonx_token() -> str:
    url = "https://iam.cloud.ibm.com/identity/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = f"grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={WATSONX_API_KEY}"
    response = requests.post(url, headers=headers, data=data, timeout=30)
    response.raise_for_status()
    return response.json()["access_token"]


def _watsonx_generate(prompt: str, system_prompt: Optional[str] = None) -> str:
    token = _get_watsonx_token()
    url = f"{WATSONX_URL.rstrip('/')}/ml/v1/text/generation?version=2023-05-29"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    payload = {
        "input": full_prompt,
        "parameters": {"decoding_method": "greedy", "max_new_tokens": 1024, "min_new_tokens": 1},
        "model_id": WATSONX_MODEL_ID,
        "project_id": WATSONX_PROJECT_ID,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    results = response.json().get("results", [])
    return results[0].get("generated_text", "") if results else ""


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

def _openai_generate(prompt: str, system_prompt: Optional[str] = None) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    response = client.chat.completions.create(model="gpt-4o-mini", messages=messages)
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Google Gemini  (your addition — kept exactly as you wrote it)
# ---------------------------------------------------------------------------

def _gemini_generate(prompt: str, system: str = "") -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)

    # Build model list: configured model first, then fallbacks
    preferred = GEMINI_MODEL if GEMINI_MODEL.startswith("models/") else f"models/{GEMINI_MODEL}"
    models_to_try = [preferred] + [m for m in _GEMINI_FALLBACK_MODELS if m != preferred]

    last_error = None
    for model_id in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system or None,
                ),
            )
            return response.text or ""
        except Exception as e:
            err_str = str(e)
            # Only continue to next model on 404/503 (not available / overloaded)
            if "404" in err_str or "503" in err_str or "NOT_FOUND" in err_str or "UNAVAILABLE" in err_str:
                logger.warning("Gemini model %s failed (%s), trying next…", model_id, err_str[:80])
                last_error = e
                continue
            raise  # re-raise unexpected errors immediately

    raise last_error or RuntimeError("All Gemini models failed")


# ---------------------------------------------------------------------------
# Dev fallback
# ---------------------------------------------------------------------------

def _dev_generate(prompt: str) -> str:
    return (
        "[DEV MODE — No AI credentials configured. This is a sample response.]\n\n"
        "To enable real AI responses, add GEMINI_API_KEY (Google Gemini), "
        "WATSONX_API_KEY + WATSONX_PROJECT_ID (IBM watsonx.ai), or OPENAI_API_KEY "
        "to your learnova-backend/.env file, then restart the server."
    )


# ---------------------------------------------------------------------------
# Public API — returns dict so all routers keep working
# ---------------------------------------------------------------------------

async def generate_text(prompt: str, max_tokens: int = 1024) -> Dict[str, Any]:
    """
    Generate text using the highest-priority configured provider.
    Returns {"text": str, "provider": str, "is_dev": bool}
    """
    provider = get_active_provider()
    try:
        if provider == "watsonx":
            text = _watsonx_generate(prompt)
            return {"text": text, "provider": "IBM watsonx.ai", "is_dev": False}
        elif provider == "openai":
            text = _openai_generate(prompt)
            return {"text": text, "provider": "OpenAI", "is_dev": False}
        elif provider == "gemini":
            text = _gemini_generate(prompt)
            return {"text": text, "provider": "Google Gemini", "is_dev": False}
        else:
            return {"text": _dev_generate(prompt), "provider": "dev", "is_dev": True}
    except Exception as exc:
        logger.error("AI provider error (%s): %s", provider, exc)
        return {
            "text": f"[AI error: {exc}]\n\n{_dev_generate(prompt)}",
            "provider": provider,
            "is_dev": True,
            "error": str(exc),
        }
