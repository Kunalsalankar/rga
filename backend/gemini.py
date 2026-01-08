from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests


TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


@dataclass(frozen=True)
class GeminiRateLimit(Exception):
    retry_after_seconds: float


def _parse_retry_delay_seconds(error_body: str) -> Optional[float]:
    try:
        data = json.loads(error_body)
        details = (data.get("error") or {}).get("details") or []
        for d in details:
            if isinstance(d, dict) and d.get("@type", "").endswith("RetryInfo"):
                delay = d.get("retryDelay")
                if isinstance(delay, str):
                    m = re.match(r"^(\d+(?:\.\d+)?)s$", delay.strip())
                    if m:
                        return float(m.group(1))
    except Exception:
        return None
    return None


def _get_api_keys() -> list[str]:
    """Extract multiple API keys from environment. Support comma or pipe-separated list."""
    explicit = (os.getenv("GEMINI_API_KEYS") or "").strip()
    if explicit:
        # Support both comma and pipe as separators
        separator = "," if "," in explicit else "|"
        keys = [k.strip() for k in explicit.split(separator) if k.strip()]
        if keys:
            return keys
    
    # Fallback to single key
    single_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if single_key:
        return [single_key]
    
    return []


def _pick_model() -> str:
    explicit = (os.getenv("GEMINI_MODEL") or "").strip()
    if explicit:
        return explicit

    csv = (os.getenv("GEMINI_MODELS") or "").strip()
    if csv:
        models = [m.strip() for m in csv.split(",") if m.strip()]
        if models:
            return models[0]

    return "models/gemini-2.5-flash"


def build_prompt(*, model_output: Dict[str, Any], rag_context: str) -> str:
    fault = model_output.get("primary_defect")
    confidence = model_output.get("confidence")
    return (
        "You are an expert solar PV operations assistant with deep knowledge of fault detection, maintenance procedures, and safety protocols.\n"
        "Your task is to provide DETAILED, COMPREHENSIVE, and ACTIONABLE guidance based on AI predictions and company maintenance knowledge.\n"
        "Be concise and prioritize clear, point-by-point guidance suitable for field technicians.\n\n"
        "═════════════════════════════════════════════════════════════════\n"
        "ML MODEL DETECTION RESULT:\n"
        "═════════════════════════════════════════════════════════════════\n"
        f"Detected Issue: {fault}\n"
        f"Confidence Level: {confidence:.2%}\n\n"
        "═════════════════════════════════════════════════════════════════\n"
        "RETRIEVED MAINTENANCE KNOWLEDGE & PROCEDURES:\n"
        "═════════════════════════════════════════════════════════════════\n"
        f"{rag_context}\n\n"
        "═════════════════════════════════════════════════════════════════\n"
        "COMPREHENSIVE RESPONSE REQUIRED:\n"
        "═════════════════════════════════════════════════════════════════\n\n"
        "Please provide a concise, well-structured response with ALL of the following sections.\n"
        "Each section should be clear and point-by-point:\n\n"
        "1️⃣ WHAT IS THIS FAULT? (Explanation in Simple Language)\n"
        "   ► 3–5 short bullet points (one sentence each): what it is; immediate impact; long-term impact (if any); main safety concerns; typical causes.\n\n"
        "2️⃣ WHAT SHOULD BE DONE IMMEDIATELY? (Recommended Action)\n"
        "   1. Start with the exact first step to take (be specific)\n"
        "   2. List immediate mitigation measures to reduce risk or damage\n"
        "   3. State required safety precautions and PPE\n"
        "   4. State who to notify (roles or team)\n\n"
        "3️⃣ HOW TO FIX IT? (Detailed Maintenance Procedure)\n"
        "   ► Provide step-by-step instructions following the relevant SOP\n"
        "   ► Include preparation steps before work begins\n"
        "   ► Detail the exact method, tools, and materials needed\n"
        "   ► Explain post-action verification steps\n"
        "   ► Include any documentation or logging requirements\n\n"
        "4️⃣ HOW URGENT IS THIS? (Urgency Assessment & Timeline)\n"
        "   ► Assess urgency level: CRITICAL / HIGH / MEDIUM / LOW\n"
        "   ► Explain the reasoning behind this urgency level\n"
        "   ► Recommend action timeline (hours, days, weeks)\n"
        "   ► Suggest preventive measures to avoid recurrence\n"
        "   ► Recommend follow-up inspection schedule\n\n"
        "Provide clear, practical guidance for each section; keep sections concise and actionable.\n"
    )


def generate_recommendation(*, model_output: Dict[str, Any], rag_context: str, max_output_tokens: int = 2500) -> str:
    """Generate recommendation using Gemini API with fallback to multiple API keys."""
    api_keys = _get_api_keys()
    if not api_keys:
        raise RuntimeError(
            "No Gemini API keys configured. "
            "Set GEMINI_API_KEYS (comma or pipe-separated) or GEMINI_API_KEY environment variable."
        )

    model = _pick_model()
    prompt = build_prompt(model_output=model_output, rag_context=rag_context)
    
    last_error: Exception | None = None
    
    for key_idx, api_key in enumerate(api_keys):
        try:
            print(f"[Attempt {key_idx + 1}/{len(api_keys)}] Using API key #{key_idx + 1}")
            url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={api_key}"
            
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.6, "maxOutputTokens": int(max_output_tokens)},
            }

            resp = requests.post(url, json=payload, timeout=120)

            if resp.status_code == 429:
                # Rate limited on this key, try next one
                retry = None
                if resp.headers.get("Retry-After"):
                    try:
                        retry = float(resp.headers["Retry-After"])
                    except Exception:
                        retry = None
                if retry is None:
                    retry = _parse_retry_delay_seconds(resp.text)
                if retry is None:
                    retry = 10.0
                
                error_msg = f"API key #{key_idx + 1} hit rate limit (429). Retry after {retry}s. Trying next key..."
                print(error_msg)
                last_error = GeminiRateLimit(retry_after_seconds=retry)
                continue  # Try next key

            if resp.status_code != 200:
                error_msg = f"Gemini API error {resp.status_code} with key #{key_idx + 1}: {resp.text}"
                print(error_msg)
                last_error = RuntimeError(error_msg)
                continue  # Try next key

            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                return ""

            content = candidates[0].get("content") or {}
            parts = content.get("parts") or []
            texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
            raw_text = "".join(texts).strip()
            
            # Post-process the response to ensure proper markdown formatting
            formatted = raw_text
            formatted = formatted.replace("### ", "## ")  # Standardize headers
            formatted = formatted.replace("## 1", "## 1️⃣")  # Add emojis to sections
            formatted = formatted.replace("## 2", "## 2️⃣")
            formatted = formatted.replace("## 3", "## 3️⃣")
            formatted = formatted.replace("## 4", "## 4️⃣")
            
            # Ensure proper line breaks
            formatted = formatted.replace("---", "\n\n---\n\n")
            formatted = formatted.replace("\n\n\n", "\n\n")
            
            print(f"[Success] Generated recommendation using API key #{key_idx + 1}")
            return formatted
            
        except (requests.Timeout, requests.ConnectionError) as e:
            error_msg = f"Connection error with API key #{key_idx + 1}: {e}. Trying next key..."
            print(error_msg)
            last_error = e
            continue
        except Exception as e:
            error_msg = f"Unexpected error with API key #{key_idx + 1}: {e}. Trying next key..."
            print(error_msg)
            last_error = e
            continue
    
    # All keys exhausted
    raise RuntimeError(
        f"All {len(api_keys)} API key(s) exhausted. Last error: {last_error}"
    )
